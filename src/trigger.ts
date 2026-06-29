import { ActivityTrigger, EntityTrigger, OrchestrationTrigger } from "durable-functions";
import { trigger as azFuncTrigger } from "@azure/functions";
import { addDurableGrpcMetadata, DurableGrpcOptions } from "./durableGrpc";

export function activity(options: DurableGrpcOptions = {}): ActivityTrigger {
    return azFuncTrigger.generic(
        addDurableGrpcMetadata(
            {
                type: "activityTrigger",
            },
            options
        )
    ) as ActivityTrigger;
}

export function orchestration(options: DurableGrpcOptions = {}): OrchestrationTrigger {
    return azFuncTrigger.generic(
        addDurableGrpcMetadata(
            {
                type: "orchestrationTrigger",
            },
            options
        )
    ) as OrchestrationTrigger;
}

export function entity(options: DurableGrpcOptions = {}): EntityTrigger {
    return azFuncTrigger.generic(
        addDurableGrpcMetadata(
            {
                type: "entityTrigger",
            },
            options
        )
    ) as EntityTrigger;
}
