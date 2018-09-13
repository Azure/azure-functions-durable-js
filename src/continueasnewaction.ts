import { ActionType, IAction } from "./classes";

export class ContinueAsNewAction implements IAction {
    public actionType: ActionType = ActionType.ContinueAsNew;

    constructor(
        public input: any,
    ) { }
}
