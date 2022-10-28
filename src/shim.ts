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
 * @param fn the generator function that should act as an orchestrator
 * @example Register an orchestrator using `app.generic()`
 * ```javascript
 * const { app } = require("@azure/functions")
 * const df = require("durable-functions");
 *
 * app.generic('DurableFunctionsOrchestratorJS', {
 *   trigger: trigger.generic({
 *       type: 'orchestrationTrigger'
 *   }),
 *   handler: df.createOrchestrator(function* (context) {
 *       // orchestrator body
 *  })
 * })
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

/**
 * Enables an entity handler function to act as a Durable Entity Azure Function.
 *
 * @param fn the handler function that should act as a durable entity
 * @example Register an entity using `app.generic()`
 * ```javascript
 * const { app } = require("@azure/functions")
 * const df = require("durable-functions");
 *
 * app.generic('DurableEntity', {
 *   trigger: trigger.generic({
 *       type: 'entityTrigger'
 *   }),
 *   handler: df.createEntityFunction(function* (context) {
 *       // orchestrator body
 *  })
 * })
 * ```
 */
export function createEntityFunction<T = unknown>(fn: EntityHandler<T>): EntityFunction<T> {
    const listener = new Entity<T>(fn).listen();

    return async (
        context: IEntityFunctionContext<T>,
        entityTrigger: DurableEntityBindingInfo
    ): Promise<EntityState> => {
        return await listener(context, entityTrigger);
    };
}

/**
 * Registers a generator function as a Durable Orchestrator for your Function App.
 *
 * @param functionName the name of your new durable orchestrator
 * @param handler the generator function that should act as an orchestrator
 *
 * @example Register an orchestrator
 * ```javascript
 * const df = require("durable-functions");
 *
 * df.orchestration('DurableFunctionsOrchestratorJS', function* (context) {
 *     // orchestrator body
 * });
 * ```
 */
export function orchestration(functionName: string, handler: OrchestrationHandler): void {
    app.generic(functionName, {
        trigger: trigger.generic({
            type: "orchestrationTrigger",
        }),
        handler: createOrchestrator(handler),
    });
}

/**
 * Registers a function as a Durable Entity for your Function App.
 *
 * @param functionName the name of your new durable entity
 * @param handler the function that should act as an entity
 *
 * @example Register a counter entity
 * ```javascript
 * const df = require("durable-functions");
 *
 * df.entity('CounterEntity', function (context) {
 *     // entity body
 * });
 * ```
 */
export function entity(functionName: string, handler: EntityHandler<unknown>): void {
    app.generic(functionName, {
        trigger: trigger.generic({
            type: "entityTrigger",
        }),
        handler: createEntityFunction(handler),
    });
}

/**
 * Registers a function as an Activity Function for your Function App.
 *
 * @param functionName the name of your new activity function
 * @param handler the function that should act as an activity
 *
 * @example Register an activity function
 * ```javascript
 * const df = require("durable-functions");
 *
 * df.activity('MyActivity', function (context) {
 *     // activity body
 * });
 * ```
 */
export function activity(functionName: string, handler: ActivityHandler<any>): void {
    app.generic(functionName, {
        trigger: trigger.generic({
            type: "activityTrigger",
        }),
        handler,
    });
}

/**
 * Registers a function as an Activity Function for your Function App,
 * allowing for extra configurations, such as extra input and output bindings
 *
 * @param functionName the name of your new activity function
 * @param options the configuration options for this activity,
 * specifying the handler and the inputs and outputs
 *
 * @example Register an activity function with extra inputs and outputs
 * ```javascript
 * const df = require("durable-functions");
 * const { input, output } = require("@azure/functions");
 *
 * df.activity('MyActivity', {
 *   extraInputs: input.storageBlob({ path: 'test/{test}', connection: 'conn' }),
 *   extraOutputs: output.storageBlob({ path: 'test/{test}', connection: 'conn' }),
 *   handler: function (context) {
 *      // activity body
 *   }
 * });
 * ```
 */
export function activityComplex(functionName: string, options: ActivityOptions<any>): void {
    app.generic(functionName, {
        trigger: trigger.generic({
            type: "activityTrigger",
        }),
        ...options,
    });
}

/**
 * Registers a function as a Durable Client for your Function App,
 * that is triggered by an HTTP request and returns an HTTP response
 *
 * @param functionName the name of your new Durable Client function
 * @param clientHandler the function handler that should act as a durable client
 *
 * @example Register an activity function with extra inputs and outputs
 * ```javascript
 * const df = require("durable-functions");
 *
 * df.httpClient('DurableFunctionsHTTPStart', function (context, client) {
 *   // function body
 * });
 * ```
 */
export function httpClient(functionName: string, clientHandler: OrchestrationClientHandler): void {
    client(functionName, trigger.http({}), output.http({}), clientHandler);
}

/**
 * Registers a function as a Durable Client for your Function App
 *
 * @param functionName the name of your new Durable Client function
 * @param trigger the trigger for the client function
 * @param returnValue the primary output of the client function
 * @param clientHandler the function handler that should act as a durable client
 *
 * @example Register a client that is triggered by HTTP requests and returns HTTP response
 * ```javascript
 * const df = require("durable-functions");
 * const { trigger, output } = require("@azure/functions");
 *
 * df.client(
 *     'DurableFunctionsHTTPStart',
 *     trigger.http({}),
 *     output.http({}),
 *     function (context, client) {
 *       // function body
 *     }
 * );
 * ```
 */
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

/**
 * Registers a function as a Durable Client for your Function App,
 * allowing extra configurations, such as extra inputs and outputs
 *
 * @param functionName the name of your new Durable Client function
 * @param options object specifying configuration options,
 * such as handler, inputs and outputs
 *
 */
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
