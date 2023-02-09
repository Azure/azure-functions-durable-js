import { ActivityTrigger } from "./activityTypes";
import { EntityTrigger } from "./entityTypes";
import { OrchestrationTrigger } from "./orchestrationTypes";

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
