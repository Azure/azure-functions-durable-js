import {
    app,
    FunctionOutput,
    FunctionTrigger,
    input,
    InvocationContext,
    output,
    trigger,
} from "@azure/functions";
import { getClient } from "./durableorchestrationclient";
import {
    ActivityHandler,
    ActivityOptions,
    EntityFunction,
    EntityHandler,
    OrchestrationClientInput,
    OrchestrationClientOptions,
    OrchestrationFunction,
    OrchestrationHandler,
    OrchestrationClientHandler,
} from "./types";
import {
    Entity,
    EntityState,
    IEntityFunctionContext,
    IOrchestrationFunctionContext,
    Orchestrator,
} from "./classes";
import { DurableEntityBindingInfo } from "./durableentitybindinginfo";
import { OrchestratorState } from "./orchestratorstate";
import { DurableOrchestrationInput } from "./testingUtils";

/**
 * Enables a generator function to act as an orchestrator function.
 *
 * Orchestration context methods can be access
 * @param fn the generator function that should act as an orchestrator
 * @example Initialize an orchestrator
 * ```javascript
 * const df = require("durable-functions");
 *
 * module.exports = df.orchestrator(function*(context) {
 *     // function body
 * });
 * ```
 */
export function createOrchestrator(fn: OrchestrationHandler): OrchestrationFunction {
    const listener = new Orchestrator(fn).listen();

    return async (
        context: IOrchestrationFunctionContext,
        orchestrationTrigger: DurableOrchestrationInput
    ): Promise<OrchestratorState> => {
        return await listener(context, orchestrationTrigger);
    };
}

export function createEntityFunction<T = unknown>(fn: EntityHandler<T>): EntityFunction<T> {
    const listener = new Entity<T>(fn).listen();

    return async (
        context: IEntityFunctionContext<T>,
        entityTrigger: DurableEntityBindingInfo
    ): Promise<EntityState> => {
        return await listener(context, entityTrigger);
    };
}

export function orchestration(functionName: string, handler: OrchestrationHandler): void {
    app.generic(functionName, {
        trigger: trigger.generic({
            type: "orchestrationTrigger",
        }),
        handler: createOrchestrator(handler),
    });
}

export function entity(functionName: string, handler: EntityHandler<unknown>): void {
    app.generic(functionName, {
        trigger: trigger.generic({
            type: "entityTrigger",
        }),
        handler: createEntityFunction(handler),
    });
}

export function activity(functionName: string, handler: ActivityHandler<any>): void {
    app.generic(functionName, {
        trigger: trigger.generic({
            type: "activityTrigger",
        }),
        handler,
    });
}

export function activityComplex(functionName: string, options: ActivityOptions<any>): void {
    app.generic(functionName, {
        trigger: trigger.generic({
            type: "activityTrigger",
        }),
        ...options,
    });
}

export function httpClient(functionName: string, clientHandler: OrchestrationClientHandler): void {
    client(functionName, trigger.http({}), output.http({}), clientHandler);
}

export function client(
    functionName: string,
    trigger: FunctionTrigger,
    returnValue: FunctionOutput | undefined,
    clientHandler: OrchestrationClientHandler
): void {
    clientComplex(functionName, {
        trigger,
        return: returnValue,
        handler: clientHandler,
    });
}

export function clientComplex(functionName: string, options: OrchestrationClientOptions): void {
    const clientInput: OrchestrationClientInput = input.generic({
        type: "orchestrationClient",
    }) as OrchestrationClientInput;

    const clientHandler = options.handler;

    const handler = (context: InvocationContext, triggerData: FunctionTrigger) => {
        const client = getClient(context, clientInput);
        return clientHandler(context, triggerData, client);
    };

    if (options.extraInputs) {
        options.extraInputs.push(clientInput);
    } else {
        options.extraInputs = [clientInput];
    }

    app.generic(functionName, {
        ...options,
        handler,
    });
}
