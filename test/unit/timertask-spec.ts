import { expect } from "chai";
import "mocha";
import { CreateTimerAction } from "../../src/classes";
import { TimerTask } from "../../src/task";

describe("TimerTask", () => {
    it("throws cannot cancel a completed task", async () => {
        const isCancelled = false;
        const date = new Date();
        const action = new CreateTimerAction(date, isCancelled);
        const task = new TimerTask(0, action);
        task.setValue(false, undefined); // set value to complete task

        expect(() => {
            task.cancel();
        }).to.throw("Cannot cancel a completed task.");
    });

    it("cancels an incomplete task", async () => {
        const isCancelled = false;
        const date = new Date();
        const action = new CreateTimerAction(date, isCancelled);
        const task = new TimerTask(0, action);

        task.cancel();
        expect(task.isCancelled).to.equal(true);
    });

    it("is canceled when its action is canceled", async () => {
        const isCancelled = true;
        const date = new Date();
        const action = new CreateTimerAction(date, isCancelled);
        const task = new TimerTask(0, action);

        expect(task.isCancelled).to.equal(true);
    });
});
