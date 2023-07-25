import { expect } from "chai";
import "mocha";
import { DFTimerTask } from "../../src/task";
import { CreateTimerAction } from "../../src/actions/CreateTimerAction";

describe("TimerTask", () => {
    it("throws cannot cancel a completed task", async () => {
        const isCanceled = false;
        const date = new Date();
        const action = new CreateTimerAction(date, isCanceled);
        const task = new DFTimerTask(0, action);
        task.setValue(false, undefined); // set value to complete task

        expect(() => {
            task.cancel();
        }).to.throw("Cannot cancel a completed task.");
    });

    it("cancels an incomplete task", async () => {
        const isCanceled = false;
        const date = new Date();
        const action = new CreateTimerAction(date, isCanceled);
        const task = new DFTimerTask(0, action);

        task.cancel();
        expect(task.isCanceled).to.equal(true);
    });

    it("is canceled when its action is canceled", async () => {
        const isCanceled = true;
        const date = new Date();
        const action = new CreateTimerAction(date, isCanceled);
        const task = new DFTimerTask(0, action);

        expect(task.isCanceled).to.equal(true);
    });
});
