import { ActionType } from "../classes";
import { CompositeAction } from "./compositeaction";

/** @hidden */
export class WhenAllAction extends CompositeAction {
    public readonly actionType: ActionType = ActionType.WhenAll;
}
