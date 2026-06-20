import { ActionType } from "./ActionType";
import { IAction } from "./IAction";

/** @hidden */
export class ReleaseEntitiesAction implements IAction {
    public readonly actionType: ActionType = ActionType.ReleaseEntities;
}
