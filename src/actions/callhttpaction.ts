import { ActionType, DurableHttpRequest, IAction, Utils } from "../classes";

/** @hidden */
export class CallHttpAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallHttp;

    constructor(
        public readonly httpRequest: DurableHttpRequest,
    ) { }
}
