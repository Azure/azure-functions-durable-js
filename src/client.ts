import * as input from "./input";
import {
    DurableClientHandler,
    DurableClientOptions,
    HttpDurableClientOptions,
    TimerDurableClientOptions,
} from "durable-functions";
import {
    FunctionHandler,
    FunctionResult,
    InvocationContext,
    app as azFuncApp,
} from "@azure/functions";
import { DurableClient } from "./durableClient/DurableClient";
import { getClient, isDurableClientInput } from "./durableClient/getClient";

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
    options.extraInputs = options.extraInputs ?? [];
    if (!options.extraInputs.find(isDurableClientInput)) {
        options.extraInputs.push(input.durableClient());
    }
}

function convertToFunctionHandler(clientHandler: DurableClientHandler): FunctionHandler {
    return (trigger: unknown, context: InvocationContext): FunctionResult<any> => {
        const client: DurableClient = getClient(context);
        return clientHandler(trigger, client, context);
    };
}
