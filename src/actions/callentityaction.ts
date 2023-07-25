import { EntityId } from "../entities/entityid";
import { Utils } from "../util/Utils";
import { ActionType } from "./actiontype";
import { IAction } from "./iaction";

/** @hidden */
export class CallEntityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallEntity;
    public readonly instanceId: string;
    public readonly input: unknown;

    constructor(entityId: EntityId, public readonly operation: string, input?: unknown) {
        if (!entityId) {
            throw new Error("Must provide EntityId to CallEntityAction constructor");
        }
        this.input = input;
        Utils.throwIfEmpty(operation, "operation");
        this.instanceId = EntityId.getSchedulerIdFromEntityId(entityId);
    }
}
