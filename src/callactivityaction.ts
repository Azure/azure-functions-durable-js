import { ActionType, IAction } from "./classes";

export class CallActivityAction implements IAction {
    public actionType: ActionType = ActionType.CallActivity;

    constructor(
        public functionName: string,
        public input: any,
    ) { }
}
