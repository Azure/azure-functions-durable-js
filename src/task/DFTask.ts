import { Task } from "durable-functions";
import { TaskBase } from "./TaskBase";
import { IAction } from "../actions/IAction";

/**
 * @hidden
 * A task that should result in an Action being communicated to the DF extension.
 */
export class DFTask extends TaskBase implements Task {
    protected action: IAction;
    public alreadyScheduled = false;

    /** Get this task's backing action */
    get actionObj(): IAction {
        return this.action;
    }
}
