import { ActivityTrigger, EntityTrigger, OrchestrationTrigger } from "durable-functions";
import { trigger as azFuncTrigger } from "@azure/functions";

export function activity(): ActivityTrigger {
    return azFuncTrigger.generic({
        type: "activityTrigger",
    }) as ActivityTrigger;
}

export function orchestration(): OrchestrationTrigger {
    return azFuncTrigger.generic({
        type: "orchestrationTrigger",
    }) as OrchestrationTrigger;
}

export function entity(): EntityTrigger {
    return azFuncTrigger.generic({
        type: "entityTrigger",
    }) as EntityTrigger;
}
