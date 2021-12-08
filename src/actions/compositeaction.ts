import { ActionType, IAction } from "../classes";

/** @hidden */
export abstract class CompositeAction implements IAction {
    public readonly actionType: ActionType;

    constructor(public readonly compoundActions: IAction[]) {}
}
