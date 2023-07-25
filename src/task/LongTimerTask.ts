import { DurableOrchestrationContext, TimerTask } from "durable-functions";
import { WhenAllTask } from "./WhenAllTask";
import moment = require("moment");
import { TaskOrchestrationExecutor } from "../orchestrations/TaskOrchestrationExecutor";
import { TaskID } from ".";
import { DFTimerTask } from "./DFTimerTask";
import { CreateTimerAction } from "../actions/createtimeraction";

/**
 * @hidden
 *
 * A long Timer Task.
 *
 * This Task is created when a timer is created with a duration
 * longer than the maximum timer duration supported by storage infrastructure.
 *
 * It extends `WhenAllTask` because it decomposes into
 * several smaller sub-`TimerTask`s
 */
export class LongTimerTask extends WhenAllTask implements TimerTask {
    public id: TaskID;
    public action: CreateTimerAction;
    private readonly executor: TaskOrchestrationExecutor;
    private readonly maximumTimerDuration: moment.Duration;
    private readonly orchestrationContext: DurableOrchestrationContext;
    private readonly longRunningTimerIntervalDuration: moment.Duration;

    public constructor(
        id: TaskID,
        action: CreateTimerAction,
        orchestrationContext: DurableOrchestrationContext,
        executor: TaskOrchestrationExecutor,
        maximumTimerLength: string,
        longRunningTimerIntervalLength: string
    ) {
        const maximumTimerDuration = moment.duration(maximumTimerLength);
        const longRunningTimerIntervalDuration = moment.duration(longRunningTimerIntervalLength);
        const currentTime = orchestrationContext.currentUtcDateTime;
        const finalFireTime = action.fireAt;
        const durationUntilFire = moment.duration(moment(finalFireTime).diff(currentTime));

        const nextFireTime: Date =
            durationUntilFire > maximumTimerDuration
                ? moment(currentTime).add(longRunningTimerIntervalDuration).toDate()
                : finalFireTime;

        const nextTimerAction = new CreateTimerAction(nextFireTime);
        const nextTimerTask = new DFTimerTask(false, nextTimerAction);
        super([nextTimerTask], action);

        this.id = id;
        this.action = action;
        this.orchestrationContext = orchestrationContext;
        this.executor = executor;
        this.maximumTimerDuration = maximumTimerDuration;
        this.longRunningTimerIntervalDuration = longRunningTimerIntervalDuration;
    }

    get isCanceled(): boolean {
        return this.action.isCanceled;
    }

    /**
     * @hidden
     * Cancel this timer task.
     * It errors out if the task has already completed.
     */
    public cancel(): void {
        if (this.hasResult) {
            throw Error("Cannot cancel a completed task.");
        }
        this.action.isCanceled = true;
    }

    /**
     * @hidden
     * Attempts to set a value to this timer, given a completed sub-timer
     *
     * @param child
     * The sub-timer that just completed
     */
    public trySetValue(child: DFTimerTask): void {
        const currentTime = this.orchestrationContext.currentUtcDateTime;
        const finalFireTime = this.action.fireAt;
        if (finalFireTime > currentTime) {
            const nextTimer: DFTimerTask = this.getNextTimerTask(finalFireTime, currentTime);
            this.addNewChild(nextTimer);
        }
        super.trySetValue(child);
    }

    private getNextTimerTask(finalFireTime: Date, currentTime: Date): DFTimerTask {
        const durationUntilFire = moment.duration(moment(finalFireTime).diff(currentTime));
        const nextFireTime: Date =
            durationUntilFire > this.maximumTimerDuration
                ? moment(currentTime).add(this.longRunningTimerIntervalDuration).toDate()
                : finalFireTime;
        return new DFTimerTask(false, new CreateTimerAction(nextFireTime));
    }

    private addNewChild(childTimer: DFTimerTask): void {
        childTimer.parent = this;
        this.children.push(childTimer);
        this.executor.trackOpenTask(childTimer);
    }
}
