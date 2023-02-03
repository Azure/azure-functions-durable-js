import { app as AzFuncApp, FunctionInput } from "@azure/functions";
import { expect } from "chai";
import sinon = require("sinon");
import {
    ActivityHandler,
    app,
    EntityContext,
    EntityHandler,
    input,
    OrchestrationHandler,
    trigger,
} from "../../src";

describe("APIs to register functions", () => {
    const appStub = sinon.stub(AzFuncApp, "generic");
    const defaultOrchestrationHandler: OrchestrationHandler = function* () {
        return "hello world";
    };
    const defaultEntityHandler: EntityHandler<string> = function (context: EntityContext<string>) {
        context.df.return("Hello world");
    };
    const defaultActivityFunction: ActivityHandler = function () {
        return "hello world";
    };

    afterEach(() => {
        appStub.reset();
    });

    describe("app.orchestration", () => {
        it("registers an orchestration function with handler directly", () => {
            const expectedFunctionName = "testFunc";
            app.orchestration(expectedFunctionName, defaultOrchestrationHandler);

            expect(appStub.callCount).to.equal(1);
            expect(appStub.args[0][0]).to.equal(expectedFunctionName);
            expect(appStub.args[0][1].trigger.type).equal("orchestrationTrigger");
            expect(appStub.args[0][1].handler).to.be.a("function");
        });

        it("registers an orchestration function with options object", () => {
            const expectedFunctionName = "testFunc";
            app.orchestration(expectedFunctionName, { handler: defaultOrchestrationHandler });

            expect(appStub.callCount).to.equal(1);
            expect(appStub.args[0][0]).to.equal(expectedFunctionName);
            expect(appStub.args[0][1].trigger.type).equal("orchestrationTrigger");
            expect(appStub.args[0][1].handler).to.be.a("function");
        });
    });

    describe("app.entity", () => {
        it("registers an entity function with handler directly", () => {
            const expectedFunctionName = "testFunc";
            app.entity(expectedFunctionName, defaultEntityHandler);

            expect(appStub.callCount).to.equal(1);
            expect(appStub.args[0][0]).to.equal(expectedFunctionName);
            expect(appStub.args[0][1].trigger.type).equal("entityTrigger");
            expect(appStub.args[0][1].handler).to.be.a("function");
        });

        it("registers an entity function with options object", () => {
            const expectedFunctionName = "testFunc";
            app.entity(expectedFunctionName, { handler: defaultEntityHandler });

            expect(appStub.callCount).to.equal(1);
            expect(appStub.args[0][0]).to.equal(expectedFunctionName);
            expect(appStub.args[0][1].trigger.type).equal("entityTrigger");
            expect(appStub.args[0][1].handler).to.be.a("function");
        });
    });

    describe("app.activity", () => {
        it("registers an activity function with options object", () => {
            const expectedFunctionName = "testFunc";
            app.activity(expectedFunctionName, { handler: defaultActivityFunction });

            expect(appStub.callCount).to.equal(1);
            expect(appStub.args[0][0]).to.equal(expectedFunctionName);
            expect(appStub.args[0][1].trigger.type).equal("activityTrigger");
            expect(appStub.args[0][1].handler).to.be.a("function");
        });
        it("passes along extra options", () => {
            const extraInput: FunctionInput = {
                type: "someType",
                name: "someName",
            };

            app.activity("testFunc", {
                handler: defaultActivityFunction,
                extraInputs: [extraInput],
            });

            expect(appStub.args[0][1].extraInputs).to.deep.equal([extraInput]);
        });
    });

    describe("trigger", () => {
        it("returns orchestration trigger object", () => {
            const options = trigger.orchestration();
            expect(options.type).to.equal("orchestrationTrigger");
            expect(options.name).to.be.a("string");
        });
        it("returns entity trigger object", () => {
            const options = trigger.entity();
            expect(options.type).to.equal("entityTrigger");
            expect(options.name).to.be.a("string");
        });
        it("returns activity trigger object", () => {
            const options = trigger.activity();
            expect(options.type).to.equal("activityTrigger");
            expect(options.name).to.be.a("string");
        });
    });

    describe("input", () => {
        it("returns a durable client input object", () => {
            const options = input.durableClient();
            expect(options.type).to.equal("durableClient");
            expect(options.name).to.be.a("string");
        });
    });
});
