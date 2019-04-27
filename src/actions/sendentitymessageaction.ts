import { ActionType, IAction, RequestMessage, Utils } from "../classes";

/** @hidden */
export class SendEntityMessageAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallEntity;

    constructor(
        public readonly functionName: string,
        public readonly input?: unknown,
        public readonly requestMessage?: RequestMessage,
    ) {
        Utils.throwIfEmpty(functionName, "functionName");
    }
    // TODO: CORRECT
}
