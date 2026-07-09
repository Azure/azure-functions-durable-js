import { expect } from "chai";
import "mocha";
import {
    buildTaskFailureDetailsJson,
    extractExceptionProperties,
    setRegisteredExceptionPropertiesProvider,
} from "../../src/error/ExceptionPropertiesProvider";
import { wrapActivityHandler } from "../../src/app";

describe("ExceptionPropertiesProvider", () => {
    // Module-level singleton; reset between tests so cases don't leak.
    afterEach(() => {
        setRegisteredExceptionPropertiesProvider(undefined);
    });

    // Safe accessor used by the activity wrapper. Must never throw and must
    // isolate caller code from provider state.
    describe("extractExceptionProperties", () => {
        it("returns undefined when no provider is registered", () => {
            expect(extractExceptionProperties(new Error("boom"))).to.equal(undefined);
        });

        it("returns the provider's properties when one is registered", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: (err) =>
                    err instanceof Error ? { name: err.name, kind: "custom" } : undefined,
            });
            expect(extractExceptionProperties(new Error("boom"))).to.deep.equal({
                name: "Error",
                kind: "custom",
            });
        });

        it("returns undefined when the provider returns undefined", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => undefined,
            });
            expect(extractExceptionProperties(new Error("boom"))).to.equal(undefined);
        });

        it("swallows provider errors and returns undefined", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => {
                    throw new Error("provider crashed");
                },
            });
            expect(extractExceptionProperties(new Error("boom"))).to.equal(undefined);
        });

        it("returns a defensive copy so callers cannot mutate provider state", () => {
            const shared = { code: 7 };
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => shared,
            });
            const out = extractExceptionProperties(new Error("boom"));
            expect(out).to.deep.equal({ code: 7 });
            (out as Record<string, unknown>).code = 99;
            expect(shared.code).to.equal(7);
        });
    });

    // buildTaskFailureDetailsJson produces the wire payload consumed by the
    // host extension's OutOfProcMiddleware.TryExtractSerializedFailureDetailsFromException.
    // Shape must match the `TaskFailureDetails` protobuf JSON encoding.
    describe("buildTaskFailureDetailsJson", () => {
        it("returns undefined when no provider is registered", () => {
            expect(buildTaskFailureDetailsJson(new Error("boom"))).to.equal(undefined);
        });

        it("returns undefined when the provider yields no properties", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => undefined,
            });
            expect(buildTaskFailureDetailsJson(new Error("boom"))).to.equal(undefined);
        });

        it("produces single-line JSON (extension parser splits on the first newline)", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => ({ code: 42 }),
            });
            const out = buildTaskFailureDetailsJson(new Error("boom"));
            expect(out).to.be.a("string");
            expect((out as string).indexOf("\n")).to.equal(-1);
        });

        it("encodes errorType, errorMessage, isNonRetriable and properties", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => ({ code: 42, label: "x" }),
            });
            const err = new Error("boom");
            const parsed = JSON.parse(buildTaskFailureDetailsJson(err) as string);
            expect(parsed.errorType).to.equal("Error");
            expect(parsed.errorMessage).to.equal("boom");
            expect(parsed.isNonRetriable).to.equal(false);
            expect(parsed.properties).to.deep.equal({ code: 42, label: "x" });
        });

        it("includes the stack trace when present", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => ({ k: "v" }),
            });
            const err = new Error("boom");
            const parsed = JSON.parse(buildTaskFailureDetailsJson(err) as string);
            expect(parsed.stackTrace).to.be.a("string");
            expect(parsed.stackTrace).to.contain("boom");
        });

        it("uses the constructor name as errorType for custom Error subclasses", () => {
            class CustomBusinessError extends Error {
                constructor(message: string, public readonly code: string) {
                    super(message);
                    this.name = "CustomBusinessError";
                }
            }
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: (e) =>
                    e instanceof CustomBusinessError ? { code: e.code } : undefined,
            });
            const parsed = JSON.parse(
                buildTaskFailureDetailsJson(new CustomBusinessError("x", "INV")) as string
            );
            expect(parsed.errorType).to.equal("CustomBusinessError");
            expect(parsed.properties).to.deep.equal({ code: "INV" });
        });

        it("falls back to Error/JSON when thrown value is not an Error instance", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => ({ raw: true }),
            });
            const parsed = JSON.parse(buildTaskFailureDetailsJson("plain string") as string);
            expect(parsed.errorType).to.equal("Error");
            expect(parsed.errorMessage).to.equal("plain string");
            expect(parsed.properties).to.deep.equal({ raw: true });
        });
    });

    // End-to-end scenario mirroring the .NET sample: customers define a domain
    // Error subclass, narrow on `instanceof` in their provider, and emit
    // domain fields that flow through to FailureDetails.Properties.
    describe("custom error class", () => {
        class CustomBusinessError extends Error {
            constructor(
                message: string,
                public readonly errorCode: string,
                public readonly httpStatus: number,
                public readonly isRetryable: boolean
            ) {
                super(message);
                this.name = "CustomBusinessError";
            }
        }

        it("extracts fields from a custom Error subclass", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: (err) =>
                    err instanceof CustomBusinessError
                        ? {
                              errorCode: err.errorCode,
                              httpStatus: err.httpStatus,
                              isRetryable: err.isRetryable,
                          }
                        : undefined,
            });
            const err = new CustomBusinessError("Inventory shortage", "INV_OUT", 409, true);
            expect(extractExceptionProperties(err)).to.deep.equal({
                errorCode: "INV_OUT",
                httpStatus: 409,
                isRetryable: true,
            });
        });

        it("returns undefined for non-matching error types", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: (err) =>
                    err instanceof CustomBusinessError ? { errorCode: err.errorCode } : undefined,
            });
            expect(extractExceptionProperties(new Error("plain"))).to.equal(undefined);
        });

        it("serializes a custom error to a parseable TaskFailureDetails payload", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: (err) =>
                    err instanceof CustomBusinessError
                        ? {
                              errorCode: err.errorCode,
                              httpStatus: err.httpStatus,
                              isRetryable: err.isRetryable,
                          }
                        : undefined,
            });
            const original = new CustomBusinessError("Inventory shortage", "INV_OUT", 409, true);
            const parsed = JSON.parse(buildTaskFailureDetailsJson(original) as string);
            expect(parsed).to.deep.include({
                errorType: "CustomBusinessError",
                errorMessage: "Inventory shortage",
                isNonRetriable: false,
                properties: {
                    errorCode: "INV_OUT",
                    httpStatus: 409,
                    isRetryable: true,
                },
            });
        });
    });

    // wrapActivityHandler is applied to every registered activity. It must
    // reshape a thrown error into the TaskFailureDetails JSON payload when a
    // provider contributes properties, and otherwise leave the error untouched.
    describe("wrapActivityHandler", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyContext: any = {};

        it("rethrows the error untouched when no provider contributes properties", async () => {
            const original = new Error("boom");
            const wrapped = wrapActivityHandler(() => {
                throw original;
            });
            let caught: unknown;
            try {
                await wrapped(undefined, anyContext);
            } catch (e) {
                caught = e;
            }
            expect(caught).to.equal(original);
            expect((caught as Error).message).to.equal("boom");
        });

        it("rethrows with the JSON payload as the message when a provider adds properties", async () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => ({ code: 42 }),
            });
            const wrapped = wrapActivityHandler(() => {
                throw new Error("boom");
            });
            let caught: unknown;
            try {
                await wrapped(undefined, anyContext);
            } catch (e) {
                caught = e;
            }
            const parsed = JSON.parse((caught as Error).message);
            expect(parsed.errorType).to.equal("Error");
            expect(parsed.errorMessage).to.equal("boom");
            expect(parsed.properties).to.deep.equal({ code: 42 });
        });

        it("falls back to a fresh Error (preserving the stack) when message is non-writable", async () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => ({ code: 7 }),
            });
            const frozen = new Error("frozen");
            Object.defineProperty(frozen, "message", {
                value: "frozen",
                writable: false,
                configurable: false,
            });
            frozen.stack = "STACK-MARKER";
            const wrapped = wrapActivityHandler(() => {
                throw frozen;
            });
            let caught: unknown;
            try {
                await wrapped(undefined, anyContext);
            } catch (e) {
                caught = e;
            }
            expect(caught).to.not.equal(frozen);
            const parsed = JSON.parse((caught as Error).message);
            expect(parsed.properties).to.deep.equal({ code: 7 });
            expect((caught as Error).stack).to.equal("STACK-MARKER");
        });
    });
});
