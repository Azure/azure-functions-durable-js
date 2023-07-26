import { CompoundTask } from "./CompoundTask";
import { AtomicTask, TaskBase, TaskID, TaskState } from ".";
import { DurableOrchestrationContext } from "../orchestrations/DurableOrchestrationContext";
import { TaskOrchestrationExecutor } from "src/orchestrations/TaskOrchestrationExecutor";
import moment = require("moment");
import { CallHttpAction } from "../actions/CallHttpAction";
import { DurableHttpResponse } from "../http/DurableHttpResponse";

/**
 * @hidden
 *
 * CallHttp Task with polling logic
 *
 * If the HTTP requests returns a 202 status code with a 'Location' header,
 * then a timer task is created, after which another HTTP request is made,
 * until a different status code is returned.
 *
 * Any other result from the HTTP requests is the result of the whole task.
 *
 * The duration of the timer is specified by the 'Retry-After' header (in seconds)
 * of the 202 response, or a default value specified by the durable extension is used.
 *
 */
export class CallHttpWithPollingTask extends CompoundTask {
    protected action: CallHttpAction;
    private readonly defaultHttpAsyncRequestSleepDuration: moment.Duration;

    public constructor(
        id: TaskID,
        action: CallHttpAction,
        private readonly orchestrationContext: DurableOrchestrationContext,
        private readonly executor: TaskOrchestrationExecutor,
        defaultHttpAsyncRequestSleepTimeMillseconds: number
    ) {
        super([new AtomicTask(id, action)], action);
        this.id = id;
        this.action = action;
        this.defaultHttpAsyncRequestSleepDuration = moment.duration(
            defaultHttpAsyncRequestSleepTimeMillseconds,
            "ms"
        );
    }

    public trySetValue(child: TaskBase): void {
        if (child.stateObj === TaskState.Completed) {
            if (child.actionObj instanceof CallHttpAction) {
                const resultObj = child.result as DurableHttpResponse;
                const result = new DurableHttpResponse(
                    resultObj.statusCode,
                    resultObj.content,
                    resultObj.headers
                );
                if (result.statusCode === 202 && result.getHeader("Location")) {
                    const retryAfterHeaderValue = result.getHeader("Retry-After");
                    const delay: moment.Duration = retryAfterHeaderValue
                        ? moment.duration(retryAfterHeaderValue, "s")
                        : this.defaultHttpAsyncRequestSleepDuration;

                    const currentTime = this.orchestrationContext.currentUtcDateTime;
                    const timerFireTime = moment(currentTime).add(delay).toDate();

                    // this should be safe since both types returned by this call
                    // (DFTimerTask and LongTimerTask) are TaskBase-conforming
                    const timerTask = (this.orchestrationContext.createTimer(
                        timerFireTime
                    ) as unknown) as TaskBase;
                    const callHttpTask = new AtomicTask(
                        false,
                        new CallHttpAction(this.action.httpRequest)
                    );

                    this.addNewChildren([timerTask, callHttpTask]);
                } else {
                    // Set the value of a non-redirect HTTP response as the value of the entire
                    // compound task
                    this.setValue(false, result);
                }
            }
        } else {
            // If any subtask failed, we fail the entire compound task
            if (this.firstError === undefined) {
                this.firstError = child.result as Error;
                this.setValue(true, this.firstError);
            }
        }
    }

    private addNewChildren(children: TaskBase[]): void {
        children.map((child) => {
            child.parent = this;
            this.children.push(child);
            this.executor.trackOpenTask(child);
        });
    }
}
