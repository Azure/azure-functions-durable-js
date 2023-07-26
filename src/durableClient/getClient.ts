import { FunctionInput, InvocationContext } from "@azure/functions";
import { DurableClient, DurableClientInput } from "durable-functions";
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
    let clientData = getClientData(context, clientInputOptions);

    if (!process.env.WEBSITE_HOSTNAME || process.env.WEBSITE_HOSTNAME.includes("0.0.0.0")) {
        clientData = correctClientData(clientData);
    }

    return new DurableClient(clientData);
}

/** @hidden */
function isDurableClientInput(input: FunctionInput): boolean {
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
