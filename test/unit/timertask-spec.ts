import { expect } from "chai";
import "mocha";
import { CreateTimerAction } from "../../src/classes";
import { TaskFactory } from "../../src/tasks/taskfactory";

describe("TimerTask", () => {
    it("throws cannot cancel a completed task", async () => {
        const task = TaskFactory.CompletedTimerTask(new CreateTimerAction(new Date(), false), new Date(), 0, 5);
        expect(() => {
            task.cancel();
        }).to.throw("Cannot cancel a completed task.");
    });

    it("cancels an incomplete task", async () => {
        const task = TaskFactory.UncompletedTimerTask(new CreateTimerAction(new Date()));
        task.cancel();
        expect(task.action.isCanceled).to.equal(true);
        expect(task.isCanceled).to.equal(true);
    });

    it("is canceled when its action is canceled", async () => {
        const task = TaskFactory.UncompletedTimerTask(new CreateTimerAction(new Date(), true));
        expect(task.isCanceled).to.equal(true);
    });
});
