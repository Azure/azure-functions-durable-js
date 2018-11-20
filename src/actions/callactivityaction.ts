import { ActionType, IAction } from "../classes";

export class CallActivityAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallActivity;

    constructor(
        public readonly functionName: string,
        public readonly input?: unknown,
    ) { }
}
