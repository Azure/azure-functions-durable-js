import { ActionType, EntityId, IAction, Utils } from "../classes";

/** @hidden */
export class CallEntityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallEntity;
    public readonly instanceId: string;
    public readonly input: unknown;

    constructor(entityId: EntityId, public readonly operation: string, input?: unknown) {
        if (!entityId) {
            throw new Error("Must provide EntityId to CallEntityAction constructor");
        }
        // If we fail to stringify inputs, they may get deserialized incorrectly.
        // For instance: "13131" might get interpreted as a number.
        // Somehow this doesn't appear to occur with other datatypes, but we should
        // investigate that further.
        if (typeof input === "string") {
            input = JSON.stringify(input);
        }
        this.input = input;
        Utils.throwIfEmpty(operation, "operation");
        this.instanceId = EntityId.getSchedulerIdFromEntityId(entityId);
    }
}
