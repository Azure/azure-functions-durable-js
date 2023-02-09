import { ActivityTrigger } from "./activity";
import { EntityTrigger } from "./entity";
import { OrchestrationTrigger } from "./orchestration";

/**
 * @returns a durable activity trigger
 */
export function activity(): ActivityTrigger;

/**
 * @returns a durable orchestration trigger
 */
export function orchestration(): OrchestrationTrigger;

/**
 * @returns a durable entity trigger
 */
export function entity(): EntityTrigger;
