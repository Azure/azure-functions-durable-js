import { ActionType } from "../classes";
import { CompositeAction } from "./compositeaction";

/** @hidden */
export class WhenAnyAction extends CompositeAction {
    public readonly actionType: ActionType = ActionType.WhenAny;
}
