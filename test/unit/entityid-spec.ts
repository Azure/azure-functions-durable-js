import { expect } from "chai";
import "mocha";
import { EntityId } from "../../src/classes";

describe("EntityId", () => {
    const defaultEntityClass = "entity";
    const defaultEntityKey = "123";
    const defaultEntityId = new EntityId(defaultEntityClass, defaultEntityKey);

    it("returns correct toString", () => {
        const expectedToString = `@${defaultEntityClass}@${defaultEntityKey}`;

        const result = defaultEntityId.toString();

        expect(result).to.equal(expectedToString);
    });

    describe("getEntityIdFromSchedulerId", () => {
        it ("constructs correct entity ID from scheduler ID", () => {
            const schedulerId = `@${defaultEntityClass}@${defaultEntityKey}`;

            const expectedEntityId = new EntityId(defaultEntityClass, defaultEntityKey);

            const result = EntityId.getEntityIdFromSchedulerId(schedulerId);

            expect(result).to.deep.equal(expectedEntityId);
        });
    });

    describe("getSchedulerIdFromEntityId", () => {
        it ("constructs correct scheduler ID from entity ID", () => {
            const expectedSchedulerId = `@${defaultEntityClass}@${defaultEntityKey}`;

            const result = EntityId.getSchedulerIdFromEntityId(defaultEntityId);

            expect(result).to.equal(expectedSchedulerId);
        });
    });
});
