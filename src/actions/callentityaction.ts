import { ActionType, IAction, Utils } from "../classes";

/** @hidden */
export class CallEntityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallEntity;

    constructor(
        public readonly entity: string,
        public readonly operation: string,
        public readonly input?: unknown,
    ) {
        Utils.throwIfEmpty(entity, "entity");
    }
}
