import { expect } from "chai";
import * as crypto from "crypto";
import "mocha";
import moment = require("moment");
import uuidv1 = require("uuid/v1");
import uuidv5 = require("uuid/v5");
import { isUUID } from "validator";
import { GuidManager } from "../../src/classes";

describe("GuidManager", () => {
    describe("createDeterministicGuid()", async () => {
        it("throws if namespaceValue is empty", () => {
            expect(() => GuidManager.createDeterministicGuid(undefined, "name"))
                .to.throw("namespaceValue: Expected non-empty, non-whitespace string but got undefined");
        });

        it("throws if name is empty", () => {
            expect(() => GuidManager.createDeterministicGuid("namespaceValue", undefined))
                .to.throw("name: Expected non-empty, non-whitespace string but got undefined");
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
