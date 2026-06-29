import { app as AzFuncApp, FunctionInput } from "@azure/functions";
import { expect } from "chai";
import sinon = require("sinon");
import { app, input, trigger } from "../../src";
import {
    ActivityHandler,
    EntityContext,
    EntityHandler,
    OrchestrationHandler,
} from "durable-functions";

describe("APIs to register functions", () => {
    const appStub = sinon.stub(AzFuncApp, "generic");
    const httpAppStub = sinon.stub(AzFuncApp, "http");
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
        httpAppStub.reset();
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

        it("can opt into durable gRPC metadata", () => {
            const expectedFunctionName = "testFunc";
            app.orchestration(expectedFunctionName, {
                handler: defaultOrchestrationHandler,
                durableRequiresGrpc: true,
            });

            expect(appStub.callCount).to.equal(1);
            expect(appStub.args[0][0]).to.equal(expectedFunctionName);
            expect(appStub.args[0][1].trigger.durableRequiresGrpc).to.equal(true);
            expect(appStub.args[0][1].durableRequiresGrpc).to.equal(undefined);
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

        it("can opt into durable gRPC metadata", () => {
            const expectedFunctionName = "testFunc";
            app.entity(expectedFunctionName, {
                handler: defaultEntityHandler,
                durableRequiresGrpc: true,
            });

            expect(appStub.callCount).to.equal(1);
            expect(appStub.args[0][0]).to.equal(expectedFunctionName);
            expect(appStub.args[0][1].trigger.durableRequiresGrpc).to.equal(true);
            expect(appStub.args[0][1].durableRequiresGrpc).to.equal(undefined);
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

        it("can opt into durable gRPC metadata", () => {
            const expectedFunctionName = "testFunc";
            app.activity(expectedFunctionName, {
                handler: defaultActivityFunction,
                durableRequiresGrpc: true,
            });

            expect(appStub.callCount).to.equal(1);
            expect(appStub.args[0][0]).to.equal(expectedFunctionName);
            expect(appStub.args[0][1].trigger.durableRequiresGrpc).to.equal(true);
            expect(appStub.args[0][1].durableRequiresGrpc).to.equal(undefined);
        });
    });

    describe("app.client", () => {
        it("can opt durable client inputs into gRPC metadata", () => {
            const expectedFunctionName = "testFunc";
            app.client.http(expectedFunctionName, {
                authLevel: "anonymous",
                methods: ["GET"],
                durableRequiresGrpc: true,
                handler: () => ({ status: 202 }),
            });

            expect(httpAppStub.callCount).to.equal(1);
            expect(httpAppStub.args[0][0]).to.equal(expectedFunctionName);
            expect(httpAppStub.args[0][1].extraInputs).to.have.length(1);
            expect(httpAppStub.args[0][1].extraInputs[0].type).to.equal("durableClient");
            expect(httpAppStub.args[0][1].extraInputs[0].durableRequiresGrpc).to.equal(true);
        });
    });

    describe("trigger", () => {
        it("returns orchestration trigger object", () => {
            const options = trigger.orchestration();
            expect(options.type).to.equal("orchestrationTrigger");
            expect(options.name).to.be.a("string");
            expect(options.durableRequiresGrpc).to.equal(undefined);
        });

        it("returns orchestration trigger object with gRPC metadata", () => {
            const options = trigger.orchestration({ durableRequiresGrpc: true });
            expect(options.type).to.equal("orchestrationTrigger");
            expect(options.name).to.be.a("string");
            expect(options.durableRequiresGrpc).to.equal(true);
        });

        it("returns entity trigger object", () => {
            const options = trigger.entity();
            expect(options.type).to.equal("entityTrigger");
            expect(options.name).to.be.a("string");
            expect(options.durableRequiresGrpc).to.equal(undefined);
        });

        it("returns entity trigger object with gRPC metadata", () => {
            const options = trigger.entity({ durableRequiresGrpc: true });
            expect(options.type).to.equal("entityTrigger");
            expect(options.name).to.be.a("string");
            expect(options.durableRequiresGrpc).to.equal(true);
        });

        it("returns activity trigger object", () => {
            const options = trigger.activity();
            expect(options.type).to.equal("activityTrigger");
            expect(options.name).to.be.a("string");
            expect(options.durableRequiresGrpc).to.equal(undefined);
        });

        it("returns activity trigger object with gRPC metadata", () => {
            const options = trigger.activity({ durableRequiresGrpc: true });
            expect(options.type).to.equal("activityTrigger");
            expect(options.name).to.be.a("string");
            expect(options.durableRequiresGrpc).to.equal(true);
        });
    });

    describe("input", () => {
        it("returns a durable client input object", () => {
            const options = input.durableClient();
            expect(options.type).to.equal("durableClient");
            expect(options.name).to.be.a("string");
            expect(options.durableRequiresGrpc).to.equal(undefined);
        });

        it("returns a durable client input object with gRPC metadata", () => {
            const options = input.durableClient({ durableRequiresGrpc: true });
            expect(options.type).to.equal("durableClient");
            expect(options.name).to.be.a("string");
            expect(options.durableRequiresGrpc).to.equal(true);
        });
    });
});
