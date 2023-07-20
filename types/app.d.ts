import { ActivityOptions, YieldableActivity } from "./activity";
import { EntityHandler, EntityOptions } from "./entity";
import { OrchestrationHandler, OrchestrationOptions } from "./orchestration";

/**
 * Registers a generator function as a Durable Orchestrator for your Function App.
 *
 * @param functionName the name of your new durable orchestrator
 * @param handler the generator function that should act as an orchestrator
 *
 */
export function orchestration(functionName: string, handler: OrchestrationHandler): void;

/**
 * Registers a generator function as a Durable Orchestrator for your Function App.
 *
 * @param functionName the name of your new durable orchestrator
 * @param options the configuration options object describing the handler for this orchestrator
 *
 */
export function orchestration(functionName: string, options: OrchestrationOptions): void;

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
export function activity(functionName: string, options: ActivityOptions): YieldableActivity;
