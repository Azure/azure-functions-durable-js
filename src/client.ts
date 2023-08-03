import * as input from "./input";
import {
    DurableClientHandler,
    DurableClientOptions,
    HttpDurableClientOptions,
    TimerDurableClientOptions,
} from "durable-functions";
import {
    FunctionHandler,
    FunctionInput,
    FunctionResult,
    InvocationContext,
    app as azFuncApp,
} from "@azure/functions";
import { DurableClient } from "./durableClient/DurableClient";
import { getClient } from "./durableClient/getClient";

export function http(functionName: string, options: HttpDurableClientOptions): void {
    addClientInput(options);
    azFuncApp.http(functionName, {
        ...options,
        handler: convertToFunctionHandler(options.handler),
    });
}

export function timer(functionName: string, options: TimerDurableClientOptions): void {
    addClientInput(options);
    azFuncApp.timer(functionName, {
        ...options,
        handler: convertToFunctionHandler(options.handler),
    });
}

export function generic(functionName: string, options: DurableClientOptions): void {
    addClientInput(options);
    azFuncApp.generic(functionName, {
        ...options,
        handler: convertToFunctionHandler(options.handler),
    });
}

function addClientInput(options: Partial<DurableClientOptions>): void {
    if (options.extraInputs && !options.extraInputs.find(isDurableClientInput)) {
        options.extraInputs.push(input.durableClient());
    } else {
        options.extraInputs = [input.durableClient()];
    }
}

function isDurableClientInput(inputOptions: FunctionInput): boolean {
    return inputOptions.type === "durableClient" || inputOptions.type === "orchestrationClient";
}

function convertToFunctionHandler(clientHandler: DurableClientHandler): FunctionHandler {
    return (trigger: unknown, context: InvocationContext): FunctionResult<any> => {
        const client: DurableClient = getClient(context);
        return clientHandler(trigger, client, context);
    };
}
