import { FunctionInput, InvocationContext } from "@azure/functions";
import { DurableClientInput } from "durable-functions";
import { DurableClient } from "./DurableClient";
import { OrchestrationClientInputData } from "./OrchestrationClientInputData";
/** @hidden */
import cloneDeep = require("lodash/cloneDeep");
/** @hidden */
import url = require("url");
import { HttpCreationPayload } from "../http/HttpCreationPayload";
import { HttpManagementPayload } from "../http/HttpManagementPayload";
import { isURL } from "validator";
import { Constants } from "../Constants";
import { DurableFunctionsClient, GrpcDurableClientConfig } from "../grpc";

export function getClient(context: InvocationContext): DurableClient {
    const foundInput: FunctionInput | undefined = context.options.extraInputs.find(
        isDurableClientInput
    );
    if (!foundInput) {
        throw new Error(
            "Could not find a registered durable client input binding. Check your extraInputs definition when registering your function."
        );
    }

    const clientInputOptions = foundInput as DurableClientInput;
    const rawClientData: unknown = context.extraInputs.get(clientInputOptions);

    // gRPC opt-in path: when the app sets `durableRequiresGrpc: true`, the Durable Task extension
    // serializes a different durable client payload (carrying `rpcBaseUrl` for the local gRPC
    // sidecar, but no creation/management URLs). Route management operations through the gRPC
    // client while leaving the default HTTP/legacy path below untouched.
    if (isGrpcClientInputData(rawClientData)) {
        const config: GrpcDurableClientConfig = {
            taskHubName: rawClientData.taskHubName,
            rpcBaseUrl: rawClientData.rpcBaseUrl,
            requiredQueryStringParameters: rawClientData.requiredQueryStringParameters,
            httpBaseUrl: rawClientData.httpBaseUrl,
        };

        // TODO: the gRPC DurableFunctionsClient mirrors the Python SDK surface, which differs from
        // the legacy HTTP DurableClient interface. getClient's public return type is kept as
        // DurableClient to avoid breaking the default path; revisit once a unified client type is
        // agreed with the extension team (andystaples).
        return (DurableFunctionsClient.fromConfig(config) as unknown) as DurableClient;
    }

    let clientData = getClientData(context, clientInputOptions);

    if (!process.env.WEBSITE_HOSTNAME || process.env.WEBSITE_HOSTNAME.includes("0.0.0.0")) {
        clientData = correctClientData(clientData);
    }

    return new DurableClient(clientData);
}

/**
 * Detects the gRPC ("middleware passthrough") durable client payload. In gRPC mode the extension
 * supplies `rpcBaseUrl` (the local gRPC sidecar address) and omits the HTTP creation/management
 * URL templates that the legacy payload carries.
 * @hidden
 */
function isGrpcClientInputData(data: unknown): data is GrpcClientInputData {
    const typed = data as { [index: string]: unknown } | undefined;
    return (
        !!typed &&
        typeof typed.rpcBaseUrl === "string" &&
        typed.rpcBaseUrl.length > 0 &&
        typed.creationUrls === undefined &&
        typed.managementUrls === undefined
    );
}

/** @hidden */
interface GrpcClientInputData {
    taskHubName?: string;
    rpcBaseUrl?: string;
    requiredQueryStringParameters?: string;
    httpBaseUrl?: string;
}

/** @hidden */
export function isDurableClientInput(input: FunctionInput): boolean {
    return input.type === "durableClient" || input.type === "orchestrationClient";
}

/** @hidden */
function getClientData(
    context: InvocationContext,
    clientInput: DurableClientInput
): OrchestrationClientInputData {
    const clientData: unknown = context.extraInputs.get(clientInput);
    if (clientData && OrchestrationClientInputData.isOrchestrationClientInputData(clientData)) {
        return clientData as OrchestrationClientInputData;
    }

    throw new Error(
        "Received input is not a valid durable client input. Check your extraInputs definition when registering your function."
    );
}

/** @hidden */
function correctClientData(clientData: OrchestrationClientInputData): OrchestrationClientInputData {
    const returnValue = cloneDeep(clientData);

    returnValue.creationUrls = correctUrls(clientData.creationUrls) as HttpCreationPayload;
    returnValue.managementUrls = correctUrls(clientData.managementUrls) as HttpManagementPayload;

    return returnValue;
}

function correctUrls(obj: { [key: string]: string }): { [key: string]: string } {
    const returnValue = cloneDeep(obj);

    const keys = Object.getOwnPropertyNames(obj);
    keys.forEach((key) => {
        const value = obj[key];

        if (
            isURL(value, {
                protocols: ["http", "https"],
                require_tld: false,
                require_protocol: true,
            })
        ) {
            const valueAsUrl = new url.URL(value);
            returnValue[key] = value.replace(valueAsUrl.origin, Constants.DefaultLocalOrigin);
        }
    });

    return returnValue;
}
