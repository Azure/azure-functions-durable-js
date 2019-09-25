import { ActionType, EntityId, IAction, Utils } from "../classes";

/** @hidden */
export class CallEntityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallEntity;
    public readonly entity: string;

    constructor(
        entityId: EntityId,
        public readonly operation: string,
        public readonly input?: unknown,
    ) {
        this.entity = EntityId.getSchedulerIdFromEntityId(entityId);
        Utils.throwIfEmpty(this.entity, "entity");
    }
}
