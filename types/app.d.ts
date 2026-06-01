import { ActivityOptions, RegisteredActivity } from "./activity";
import { EntityHandler, EntityOptions } from "./entity";
import { ExceptionPropertiesProvider } from "./exceptionPropertiesProvider";
import {
    OrchestrationHandler,
    OrchestrationOptions,
    RegisteredOrchestration,
} from "./orchestration";

/**
 * Registers a generator function as a Durable Orchestrator for your Function App.
 *
 * @param functionName the name of your new durable orchestrator
 * @param handler the generator function that should act as an orchestrator
 *
 */
export function orchestration(
    functionName: string,
    handler: OrchestrationHandler
): RegisteredOrchestration;

/**
 * Registers a generator function as a Durable Orchestrator for your Function App.
 *
 * @param functionName the name of your new durable orchestrator
 * @param options the configuration options object describing the handler for this orchestrator
 *
 */
export function orchestration(
    functionName: string,
    options: OrchestrationOptions
): RegisteredOrchestration;

/**
 * Registers a function as a Durable Entity for your Function App.
 *
 * @param functionName the name of your new durable entity
 * @param handler the function that should act as an entity
 *
 */
export function entity<T = unknown>(functionName: string, handler: EntityHandler<T>): void;

/**
 * Registers a function as a Durable Entity for your Function App.
 *
 * @param functionName the name of your new durable entity
 * @param options the configuration options object describing the handler for this entity
 *
 */
export function entity<T = unknown>(functionName: string, options: EntityOptions<T>): void;

/**
 * Registers a function as an Activity Function for your Function App
 *
 * @param functionName the name of your new activity function
 * @param options the configuration options for this activity, specifying the handler and the inputs and outputs
 */
export function activity(functionName: string, options: ActivityOptions): RegisteredActivity;

/**
 * Registers a global {@link ExceptionPropertiesProvider} for the function app.
 *
 * When an activity or orchestrator function throws, the provider is consulted
 * to extract custom properties from the error. Those properties are propagated
 * to the Durable Task host extension and surfaced on the resulting
 * `FailureDetails.Properties` field.
 *
 * Call this once at app startup. Calling it again replaces the previous
 * provider. Pass `undefined` to unregister.
 *
 * @param provider the provider implementation, or `undefined` to clear.
 */
export function setExceptionPropertiesProvider(
    provider: ExceptionPropertiesProvider | undefined
): void;

export * as client from "./app.client";
