import * as input from "./input";
import {
    CosmosDBDurableClientOptions,
    DurableClientHandler,
    DurableClientOptions,
    EventGridDurableClientOptions,
    EventHubDurableClientOptions,
    HttpDurableClientOptions,
    ServiceBusQueueDurableClientOptions,
    ServiceBusTopicDurableClientOptions,
    StorageBlobDurableClientOptions,
    StorageQueueDurableClientOptions,
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

export function storageBlob(functionName: string, options: StorageBlobDurableClientOptions): void {
    addClientInput(options);
    azFuncApp.storageBlob(functionName, {
        ...options,
        handler: convertToFunctionHandler(options.handler),
    });
}

export function storageQueue(
    functionName: string,
    options: StorageQueueDurableClientOptions
): void {
    addClientInput(options);
    azFuncApp.storageQueue(functionName, {
        ...options,
        handler: convertToFunctionHandler(options.handler),
    });
}

export function serviceBusQueue(
    functionName: string,
    options: ServiceBusQueueDurableClientOptions
): void {
    addClientInput(options);
    azFuncApp.serviceBusQueue(functionName, {
        ...options,
        handler: convertToFunctionHandler(options.handler),
    });
}

export function serviceBusTopic(
    functionName: string,
    options: ServiceBusTopicDurableClientOptions
): void {
    addClientInput(options);
    azFuncApp.serviceBusTopic(functionName, {
        ...options,
        handler: convertToFunctionHandler(options.handler),
    });
}

export function eventHub(functionName: string, options: EventHubDurableClientOptions): void {
    addClientInput(options);
    azFuncApp.eventHub(functionName, {
        ...options,
        handler: convertToFunctionHandler(options.handler),
    });
}

export function eventGrid(functionName: string, options: EventGridDurableClientOptions): void {
    addClientInput(options);
    azFuncApp.eventGrid(functionName, {
        ...options,
        handler: convertToFunctionHandler(options.handler),
    });
}

export function cosmosDB(functionName: string, options: CosmosDBDurableClientOptions): void {
    addClientInput(options);
    azFuncApp.cosmosDB(functionName, {
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
