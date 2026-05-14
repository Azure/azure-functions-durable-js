import { expect } from "chai";
import "mocha";
import { ActionType } from "../../src/actions/ActionType";
import { CreateTimerAction } from "../../src/actions/CreateTimerAction";

describe("CreateTimerAction", () => {
    it("constructs successfully when given a valid Date", () => {
        const fireAt = new Date();

        const action = new CreateTimerAction(fireAt);

        expect(action.actionType).to.equal(ActionType.CreateTimer);
        expect(action.fireAt).to.equal(fireAt);
        expect(action.isCanceled).to.equal(false);
    });

    it("respects the isCanceled flag passed to the constructor", () => {
        const action = new CreateTimerAction(new Date(), true);
        expect(action.isCanceled).to.equal(true);
    });

    it("throws TypeError when fireAt is not a Date", () => {
        expect(() => new CreateTimerAction("not-a-date" as unknown as Date)).to.throw(
            TypeError,
            /Expected valid Date object/
        );
    });

    it("throws TypeError when fireAt is undefined", () => {
        expect(() => new CreateTimerAction(undefined as unknown as Date)).to.throw(
            TypeError,
            /Expected valid Date object/
        );
    });
});
