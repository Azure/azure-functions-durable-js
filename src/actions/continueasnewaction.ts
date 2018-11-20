import { ActionType, IAction } from "../classes";

export class ContinueAsNewAction implements IAction {
    public readonly actionType: ActionType = ActionType.ContinueAsNew;

    constructor(
        public readonly input: unknown,
    ) { }
}
