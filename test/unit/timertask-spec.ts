import { expect } from "chai";
import "mocha";
import { CreateTimerAction } from "../../src/classes";
import { TimerTask } from "../../src/tasks/externalTasks";
import { InnerTimerTask } from "../../src/tasks/internalTasks";

describe("TimerTask", () => {
    it("throws cannot cancel a completed task", async () => {
        const isCancelled = false;
        const date = new Date();
        const action = new CreateTimerAction(date, isCancelled);
        const innerTask = new InnerTimerTask(0, action);
        innerTask.SetValue(false, undefined); // set value to complete task

        const task = new TimerTask(innerTask);
        task.internalTask.SetValue(false, undefined);

        expect(() => {
            task.cancel();
        }).to.throw("Cannot cancel a completed task.");
    });

    it("cancels an incomplete task", async () => {
        const isCancelled = false;
        const date = new Date();
        const action = new CreateTimerAction(date, isCancelled);
        const innerTask = new InnerTimerTask(0, action);

        const task = new TimerTask(innerTask);
        task.cancel();
        expect(task.isCancelled).to.equal(true);
        expect(task.isCancelled).to.equal(true);
    });

    it("is canceled when its action is canceled", async () => {
        const isCancelled = true;
        const date = new Date();
        const action = new CreateTimerAction(date, isCancelled);
        const innerTask = new InnerTimerTask(0, action);

        const task = new TimerTask(innerTask);
        expect(task.isCancelled).to.equal(true);
    });
});
