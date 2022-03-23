import { ActionType } from "./actiontype";
import { IAction } from "./iaction";

export class CreateLongTimerAction implements IAction {
    public readonly actionType: ActionType;
}
