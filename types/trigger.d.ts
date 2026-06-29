import { ActivityTrigger } from "./activity";
import { DurableGrpcOptions } from "./durableGrpc";
import { EntityTrigger } from "./entity";
import { OrchestrationTrigger } from "./orchestration";

/**
 * @returns a durable activity trigger
 */
export function activity(options?: DurableGrpcOptions): ActivityTrigger;

/**
 * @returns a durable orchestration trigger
 */
export function orchestration(options?: DurableGrpcOptions): OrchestrationTrigger;

/**
 * @returns a durable entity trigger
 */
export function entity(options?: DurableGrpcOptions): EntityTrigger;
