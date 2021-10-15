import { ActionType } from "../classes";

/** @hidden */
export interface IAction {
    actionType: ActionType;
}

export interface ICompoundAction extends IAction {
    children: IAction[];
}
