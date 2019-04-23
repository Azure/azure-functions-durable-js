import { expect } from "chai";
import "mocha";
import { ActorId } from "../../src/classes";

describe("ActorId", () => {
    it("returns correct toString", () => {
        const actorClass = "actor";
        const actorKey = "123";
        const actorId = new ActorId(actorClass, actorKey);

        const expectedToString = `@${actorClass}@${actorKey}`;

        const result = actorId.toString();

        expect(result).to.equal(expectedToString);
    });

    describe("getActorIdFromSchedulerId", () => {
        it ("constructs correct actor ID from scheduler ID", () => {
            const actorClass = "actor";
            const actorKey = "123";
            const schedulerId = `@${actorClass}@${actorKey}`;

            const expectedActorId = new ActorId(actorClass, actorKey);

            const result = ActorId.getActorIdFromSchedulerId(schedulerId);

            expect(result).to.deep.equal(expectedActorId);
        });
    });

    describe("getSchedulerIdFromActorId", () => {
        it ("constructs correct scheduler ID from actor ID", () => {
            const actorClass = "actor";
            const actorKey = "123";
            const actorId = new ActorId(actorClass, actorKey);

            const expectedSchedulerId = `@${actorClass}@${actorKey}`;

            const result = ActorId.getSchedulerIdFromActorId(actorId);

            expect(result).to.equal(expectedSchedulerId);
        });
    });
});
