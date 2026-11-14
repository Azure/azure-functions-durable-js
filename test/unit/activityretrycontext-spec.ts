import { InvocationContext } from "@azure/functions";
import { ActivityHandler, DurableActivityContext } from "durable-functions";
import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import sinon = require("sinon");
import { readFileSync } from "fs";
import { createRequire } from "module";
import { runInNewContext } from "vm";
import { wrapActivityHandler } from "../../src/app";
import { DurableError } from "../../src/error/DurableError";
import { setRegisteredExceptionPropertiesProvider } from "../../src/error/ExceptionPropertiesProvider";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Activity retry context", () => {
    const metadata = { AttemptNumber: 1, MaxAttempts: 3, RetryGroupId: "retry-group" };

    function createContext(value: unknown): DurableActivityContext {
        return new InvocationContext({
            functionName: "activity",
            triggerMetadata: { durableActivityRetryMetadata: value },
        });
    }

    async function createConvertedContext(value?: string): Promise<DurableActivityContext> {
        interface InvocationModel {
            getArguments(): Promise<{ context: DurableActivityContext }>;
        }
        interface ProgrammingModel {
            getInvocationModel(context: object): InvocationModel;
        }
        let programmingModel: ProgrammingModel | undefined;
        const coreApi = {
            setProgrammingModel(model: ProgrammingModel) {
                programmingModel = model;
            },
            registerFunction() {
                return undefined;
            },
        };
        const entry = require.resolve("@azure/functions");
        const libraryRequire = createRequire(entry);
        const libraryModule = { exports: {} as typeof import("@azure/functions") };
        runInNewContext(readFileSync(entry, "utf8"), {
            module: libraryModule,
            exports: libraryModule.exports,
            require: (name: string) =>
                name === "@azure/functions-core" ? coreApi : libraryRequire(name),
            Buffer,
            console,
            process,
            URL,
            URLSearchParams,
        });
        libraryModule.exports.app.generic("activity", {
            trigger: { type: "activityTrigger", name: "input" },
            handler: () => undefined,
        });
        if (!programmingModel) {
            throw new Error("Functions library did not register its programming model.");
        }
        const model = programmingModel.getInvocationModel({
            invocationId: "test-invocation",
            metadata: {
                name: "activity",
                bindings: { input: { type: "activityTrigger", direction: "in" } },
            },
            request: {
                triggerMetadata:
                    value === undefined ? {} : { durableActivityRetryMetadata: { string: value } },
            },
        });
        return (await model.getArguments()).context;
    }

    afterEach(() => {
        setRegisteredExceptionPropertiesProvider(undefined);
    });

    for (const attemptNumber of [1, 2, 3]) {
        it(`accepts attempt ${attemptNumber} after the real Functions RPC conversion`, async () => {
            const expected = { attemptNumber, maxAttempts: 3, retryGroupId: "retry-group" };
            const context = await createConvertedContext(
                JSON.stringify({ ...metadata, AttemptNumber: attemptNumber })
            );
            expect(context.triggerMetadata?.durableActivityRetryMetadata).to.deep.equal(expected);
            const originalMetadata = context.triggerMetadata;
            await wrapActivityHandler((_input, receivedContext) => {
                expect(receivedContext).to.equal(context);
                expect(receivedContext.triggerMetadata).to.equal(originalMetadata);
                expect(receivedContext.activityRetryContext).to.deep.equal(expected);
            })(undefined, context);
        });
    }

    it("leaves retry context absent after the real converter receives no metadata", async () => {
        const context = await createConvertedContext();
        await wrapActivityHandler((_input, receivedContext) => {
            expect(receivedContext).not.to.have.property("activityRetryContext");
        })(undefined, context);
    });

    for (const [attempt, maxAttempts] of [
        [1, 1],
        [1, 3],
        [2, 3],
        [3, 3],
    ]) {
        it(`exposes attempt ${attempt} of ${maxAttempts} without replacing the context`, async () => {
            const context = createContext(
                JSON.stringify({ ...metadata, AttemptNumber: attempt, MaxAttempts: maxAttempts })
            );
            const input = { orderId: 7 };
            const output = { processed: true };
            const log = context.log;
            const extraInputs = context.extraInputs;
            const handler: ActivityHandler = (receivedInput, receivedContext) => {
                expect(receivedInput).to.equal(input);
                expect(receivedContext).to.equal(context);
                expect(receivedContext).to.be.instanceOf(InvocationContext);
                expect(receivedContext.log).to.equal(log);
                expect(receivedContext.extraInputs).to.equal(extraInputs);
                expect(receivedContext.activityRetryContext).to.deep.equal({
                    attemptNumber: attempt,
                    maxAttempts,
                    retryGroupId: "retry-group",
                });
                return output;
            };

            expect(await wrapActivityHandler(handler)(input, context)).to.equal(output);
        });
    }

    it("preserves async handler results", async () => {
        const output = { processed: true };
        expect(
            await wrapActivityHandler(async () => output)(
                undefined,
                createContext(JSON.stringify(metadata))
            )
        ).to.equal(output);
    });

    it("keeps Functions host retries separate from durable activity retries", async () => {
        const retryContext = { retryCount: 7, maxRetryCount: 10 };
        const context: DurableActivityContext = new InvocationContext({
            retryContext,
            triggerMetadata: { durableActivityRetryMetadata: JSON.stringify(metadata) },
        });
        await wrapActivityHandler((_input, receivedContext) => {
            expect(receivedContext.retryContext).to.equal(retryContext);
            expect(receivedContext.activityRetryContext?.attemptNumber).to.equal(1);
        })(undefined, context);
        expect(context.retryContext).to.equal(retryContext);
    });

    for (const triggerMetadata of [undefined, {}, { unrelated: "value" }]) {
        it(`does not infer retries when metadata is missing (${JSON.stringify(
            triggerMetadata
        )})`, async () => {
            const context: DurableActivityContext = new InvocationContext({
                triggerMetadata,
                retryContext: { retryCount: 2, maxRetryCount: 5 },
            });
            await wrapActivityHandler((_input, receivedContext) => {
                expect(receivedContext.activityRetryContext).to.equal(undefined);
                expect(receivedContext).not.to.have.property("activityRetryContext");
                expect(receivedContext.retryContext?.retryCount).to.equal(2);
            })(undefined, context);
        });
    }

    it("does not increment attempts on redelivery or separate worker invocations", async () => {
        const delivered: number[] = [];
        const wrapped = wrapActivityHandler((_input, context) => {
            delivered.push(context.activityRetryContext?.attemptNumber ?? -1);
            return context.activityRetryContext?.retryGroupId;
        });
        const value = JSON.stringify({ ...metadata, AttemptNumber: 2 });
        for (let delivery = 0; delivery < 3; delivery++) {
            expect(await wrapped(undefined, createContext(value))).to.equal("retry-group");
        }
        expect(delivered).to.deep.equal([2, 2, 2]);
    });

    it("accepts the int32 upper bound, ignores unrelated fields, and preserves the group ID", async () => {
        const context = createContext(
            JSON.stringify({
                AttemptNumber: 2147483647,
                MaxAttempts: 2147483647,
                RetryGroupId: " group-value ",
                FutureField: true,
            })
        );
        await wrapActivityHandler((_input, receivedContext) => {
            expect(receivedContext.activityRetryContext).to.deep.equal({
                attemptNumber: 2147483647,
                maxAttempts: 2147483647,
                retryGroupId: " group-value ",
            });
        })(undefined, context);
    });

    const invalidValues: [string, unknown][] = [
        ["present undefined", undefined],
        ["present null", null],
        ["unconverted PascalCase object", metadata],
        ["non-string number", 1],
        ["non-string boolean", true],
        ["empty string", ""],
        ["invalid JSON", "{"],
        ["JSON null", "null"],
        ["JSON array", "[]"],
        ["JSON string", '"metadata"'],
        ["JSON number", "1"],
        ["JSON boolean", "true"],
        ["missing fields", "{}"],
        [
            "camelCase wire fields",
            JSON.stringify({ attemptNumber: 1, maxAttempts: 3, retryGroupId: "group" }),
        ],
        ["attempt exceeds maximum", JSON.stringify({ ...metadata, AttemptNumber: 4 })],
        ["empty group", JSON.stringify({ ...metadata, RetryGroupId: "" })],
        ["whitespace group", JSON.stringify({ ...metadata, RetryGroupId: " \t\n" })],
        ["non-string group", JSON.stringify({ ...metadata, RetryGroupId: 1 })],
        ["null group", JSON.stringify({ ...metadata, RetryGroupId: null })],
        ["missing group", JSON.stringify({ AttemptNumber: 1, MaxAttempts: 3 })],
        [
            "non-finite JSON number",
            '{"AttemptNumber":1,"MaxAttempts":1e400,"RetryGroupId":"group"}',
        ],
    ];
    for (const field of ["AttemptNumber", "MaxAttempts"]) {
        for (const value of [0, -1, 1.5, 2147483648, "1", true, null, undefined]) {
            invalidValues.push([
                `${field} is ${String(value)}`,
                JSON.stringify({ ...metadata, [field]: value }),
            ]);
        }
    }

    for (const [description, value] of invalidValues) {
        it(`rejects ${description} before invoking customer code`, async () => {
            const handler = sinon.spy();
            const context = createContext(value);
            await expect(wrapActivityHandler(handler)(undefined, context)).to.be.rejectedWith(
                DurableError,
                "Invalid durableActivityRetryMetadata contract:"
            );
            expect(handler.called).to.equal(false);
            expect(context).not.to.have.property("activityRetryContext");
        });
    }

    for (const [description, value] of invalidValues) {
        if (typeof value !== "string" || description === "camelCase wire fields") {
            continue;
        }
        it(`rejects ${description} after the real Functions RPC conversion`, async () => {
            const handler = sinon.spy();
            const context = await createConvertedContext(value);
            await expect(wrapActivityHandler(handler)(undefined, context)).to.be.rejectedWith(
                DurableError,
                "Invalid durableActivityRetryMetadata contract:"
            );
            expect(handler.called).to.equal(false);
            expect(context).not.to.have.property("activityRetryContext");
        });
    }

    it("does not pass contract errors through the customer exception properties provider", async () => {
        const provider = sinon.spy(() => ({ custom: "value" }));
        setRegisteredExceptionPropertiesProvider({ getExceptionProperties: provider });
        await expect(
            wrapActivityHandler(() => "not invoked")(undefined, createContext("{"))
        ).to.be.rejectedWith(
            DurableError,
            "Invalid durableActivityRetryMetadata contract: expected valid JSON."
        );
        expect(provider.called).to.equal(false);
    });
});
