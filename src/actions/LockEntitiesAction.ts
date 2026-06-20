import { EntityId } from "../entities/EntityId";
import { ActionType } from "./ActionType";
import { IAction } from "./IAction";

/** @hidden */
interface LockSetEntry {
    name: string;
    key: string;
}

/** @hidden */
export class LockEntitiesAction implements IAction {
    public readonly actionType: ActionType = ActionType.LockEntities;
    public readonly lockRequestId: string;
    public readonly lockSet: LockSetEntry[];

    constructor(lockSet: EntityId[], lockRequestId: string) {
        this.lockRequestId = lockRequestId;
        this.lockSet = lockSet.map((e) => ({ name: e.name, key: e.key }));
    }
}
