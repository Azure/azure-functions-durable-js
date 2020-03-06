import { ActionType, EntityId, IAction, Utils } from "../classes";

/** @hidden */
export class SignalEntityAction implements IAction {
    public readonly actionType: ActionType = ActionType.SignalEntity;
    public readonly instanceId: string;

    constructor(
        entityId: EntityId,
        public readonly operation: string,
        public readonly input?: unknown,
    ) {
        if (!entityId) {
            throw new Error("Must provide EntityId to SignalEntityAction constructor");
        }
        Utils.throwIfEmpty(operation, "operation");
        this.instanceId = EntityId.getSchedulerIdFromEntityId(entityId);
    }
}
