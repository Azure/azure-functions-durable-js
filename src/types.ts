import {
    FunctionInput,
    FunctionHandler,
    FunctionOutput,
    FunctionTrigger,
    FunctionOptions,
} from "@azure/functions";
import { IEntityFunctionContext } from "../src/ientityfunctioncontext";
import { IOrchestrationFunctionContext } from "../src/iorchestrationfunctioncontext";

// orchestrations
export type OrchestrationHandler = (
    context: IOrchestrationFunctionContext
) => Generator<unknown, unknown, any>;

export interface OrchestrationOptions extends Partial<FunctionOptions> {
    handler: OrchestrationHandler;
}

export interface OrchestrationTrigger extends FunctionTrigger {
    type: "orchestrationTrigger";
}

// entities
export type EntityHandler<T> = (context: IEntityFunctionContext<T>) => void;

export interface EntityOptions<T> extends Partial<FunctionOptions> {
    handler: EntityHandler<T>;
}

export interface EntityTrigger extends FunctionTrigger {
    type: "entityTrigger";
}

// activities
export type ActivityHandler = FunctionHandler;

export interface ActivityOptions extends Partial<FunctionOptions> {
    handler: ActivityHandler;
    extraInputs?: FunctionInput[];
    extraOutputs?: FunctionOutput[];
}

export interface ActivityTrigger extends FunctionTrigger {
    type: "activityTrigger";
}

// clients
export interface DurableClientInput extends FunctionInput {
    type: "durableClient";
}

/**
 * Options object provided as an optional second argument to the `client.startNew()` method
 */
export interface StartNewOptions {
    /**
     *  The ID to use for the new orchestration instance. If
     *  no instanceId is specified, the Durable Functions extension will
     *  generate a random GUID (recommended).
     */
    instanceId?: string;

    /**
     * JSON-serializable input value for the orchestrator function.
     */
    input?: unknown;
}
