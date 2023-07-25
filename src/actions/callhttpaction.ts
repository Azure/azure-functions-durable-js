import { DurableHttpRequest } from "../http/DurableHttpRequest";
import { ActionType } from "./ActionType";
import { IAction } from "./IAction";

/** @hidden */
export class CallHttpAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallHttp;

    constructor(public readonly httpRequest: DurableHttpRequest) {}
}
