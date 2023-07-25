import { DurableHttpRequest } from "../http/DurableHttpRequest";
import { ActionType } from "./actiontype";
import { IAction } from "./iaction";

/** @hidden */
export class CallHttpAction implements IAction {
    public readonly actionType: ActionType = ActionType.CallHttp;

    constructor(public readonly httpRequest: DurableHttpRequest) {}
}
