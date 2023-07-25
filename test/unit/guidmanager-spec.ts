import { expect } from "chai";
import "mocha";
import moment = require("moment");
import { GuidManager } from "../../src/guidmanager";
import uuidv1 = require("uuid/v1");
import { isUUID } from "validator";

describe("GuidManager", () => {
    describe("createDeterministicGuid()", async () => {
        it("throws if namespaceValue is empty", () => {
            expect(() => GuidManager.createDeterministicGuid("", "name")).to.throw(
                "namespaceValue: Expected non-empty, non-whitespace string but got empty string"
            );
        });

        it("throws if name is empty", () => {
            expect(() => GuidManager.createDeterministicGuid("namespaceValue", "")).to.throw(
                "name: Expected non-empty, non-whitespace string but got empty string"
            );
        });

        it("returns consistent GUID for namespace and name", () => {
            const namespace = GuidManager.UrlNamespaceValue;
            const instanceId = uuidv1();
            const currentUtcDateTime = moment.utc().toDate().valueOf();

            const name1 = `${instanceId}_${currentUtcDateTime}_0`;
            const name2 = `${instanceId}_${currentUtcDateTime}_12`;

            const result1a = GuidManager.createDeterministicGuid(namespace, name1);
            const result1b = GuidManager.createDeterministicGuid(namespace, name1);

            const result2a = GuidManager.createDeterministicGuid(namespace, name2);
            const result2b = GuidManager.createDeterministicGuid(namespace, name2);

            expect(isUUID(result1a, "5")).to.equal(true);
            expect(isUUID(result2a, "5")).to.equal(true);
            expect(result1a).to.equal(result1b);
            expect(result2a).to.equal(result2b);
            expect(result1a).to.not.equal(result2a);
        });
    });
});
