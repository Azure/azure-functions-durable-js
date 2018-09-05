import { expect } from "chai";
import "mocha";
import { CreateTimerAction, TimerTask } from "../../src/classes";

describe("TimerTask", () => {
    it ("throws cannot cancel a completed task", (done) => {
        const task = new TimerTask(true, undefined, undefined, undefined, undefined);
        expect(() => {
            task.cancel();
        }).to.throw("Cannot cancel a completed task.");
        done();
    });

    it ("cancels an incomplete task", (done) => {
        const task = new TimerTask(
            false,
            false,
            new CreateTimerAction(new Date()),
            undefined,
            undefined,
            undefined);
        task.cancel();
        expect(task.action.isCanceled).to.equal(true);
        expect(task.isCanceled).to.equal(true);
        done();
    });

    it ("is canceled when its action is canceled", (done) => {
        const task = new TimerTask(
            false,
            false,
            new CreateTimerAction(new Date(), true),
            undefined,
            undefined,
            undefined);
        expect(task.isCanceled).to.equal(true);
        done();
    });
});
