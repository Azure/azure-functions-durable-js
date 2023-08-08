import { OrchestrationContext } from "durable-functions";
import { CallEntityAction } from "../actions/CallEntityAction";
import { EntityId } from "../entities/EntityId";
import { AtomicTask } from "./AtomicTask";
import * as types from "durable-functions";

export class CallEntityTask extends AtomicTask implements types.CallEntityTask {
    signal: () => void;

    constructor(
        context: OrchestrationContext,
        entityId: EntityId,
        operationName: string,
        input?: unknown
    ) {
        super(false, new CallEntityAction(entityId, operationName, input));

        this.signal = () => {
            context.df.signalEntity(entityId, operationName, input);
        };
    }
}
