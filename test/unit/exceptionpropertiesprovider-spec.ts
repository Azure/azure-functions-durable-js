import { expect } from "chai";
import "mocha";
import {
    appendExceptionPropertiesSuffix,
    exceptionPropertiesLabel,
    extractExceptionProperties,
    setRegisteredExceptionPropertiesProvider,
} from "../../src/error/ExceptionPropertiesProvider";
import { OrchestrationFailureError } from "../../src/error/OrchestrationFailureError";
import { OrchestratorState } from "../../src/orchestrations/OrchestratorState";
import { ReplaySchema } from "../../src/orchestrations/ReplaySchema";

describe("ExceptionPropertiesProvider", () => {
    // The provider is a module-level singleton; reset after every test so cases don't leak.
    afterEach(() => {
        setRegisteredExceptionPropertiesProvider(undefined);
    });

    // extractExceptionProperties is the safe accessor used by the activity/orchestrator
    // code paths. It must never throw, and must isolate caller code from provider state.
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

    // appendExceptionPropertiesSuffix is the wire-format helper: when a provider yields
    // properties, it tacks `\n\n$FailureProperties$:<json>` onto the error message so the
    // host's OOProc middleware can recover the structured payload from the failure string.
    describe("appendExceptionPropertiesSuffix", () => {
        it("returns the message unchanged when no provider is registered", () => {
            expect(appendExceptionPropertiesSuffix("boom", new Error("boom"))).to.equal("boom");
        });

        it("appends the sentinel-prefixed JSON when properties are returned", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => ({ code: 42, name: "thing" }),
            });
            const out = appendExceptionPropertiesSuffix("boom", new Error("boom"));
            expect(out).to.equal(
                `boom${exceptionPropertiesLabel}${JSON.stringify({ code: 42, name: "thing" })}`
            );
        });

        it("leaves the message untouched when the provider opts out", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => undefined,
            });
            expect(appendExceptionPropertiesSuffix("boom", new Error("boom"))).to.equal("boom");
        });
    });

    // OrchestrationFailureError already appends a `$OutOfProcData$:<json>` suffix that carries
    // orchestrator state back to the host. The properties suffix must land BEFORE that segment
    // so the existing parser keeps working unchanged.
    describe("OrchestrationFailureError integration", () => {
        it("includes the properties suffix before the OutOfProcData segment", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: () => ({ code: 42 }),
            });
            const state = new OrchestratorState({
                isDone: false,
                actions: [[]],
                output: undefined,
                schemaVersion: ReplaySchema.V1,
            });
            const err = new OrchestrationFailureError(new Error("boom"), state);
            expect(err.message).to.contain(
                `boom${exceptionPropertiesLabel}${JSON.stringify({ code: 42 })}`
            );
            expect(err.message).to.contain("$OutOfProcData$");
            expect(err.message.indexOf("$FailureProperties$")).to.be.lessThan(
                err.message.indexOf("$OutOfProcData$")
            );
        });

        it("omits the properties suffix when no provider is registered", () => {
            const state = new OrchestratorState({
                isDone: false,
                actions: [[]],
                output: undefined,
                schemaVersion: ReplaySchema.V1,
            });
            const err = new OrchestrationFailureError(new Error("boom"), state);
            expect(err.message).to.not.contain("$FailureProperties$");
            expect(err.message).to.contain("$OutOfProcData$");
        });
    });

    // End-to-end scenario mirroring the .NET sample: customers define their own Error
    // subclass carrying domain fields, then the provider narrows on `instanceof` and emits
    // those fields. Validates the realistic usage shape, not just primitives.
    describe("custom error class", () => {
        // Stand-in for a customer's domain exception (e.g. a business-rule violation).
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
                getExceptionProperties: (err) => {
                    if (err instanceof CustomBusinessError) {
                        return {
                            errorCode: err.errorCode,
                            httpStatus: err.httpStatus,
                            isRetryable: err.isRetryable,
                        };
                    }
                    return undefined;
                },
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

        it("flows custom error properties through OrchestrationFailureError", () => {
            setRegisteredExceptionPropertiesProvider({
                getExceptionProperties: (err) => {
                    if (err instanceof CustomBusinessError) {
                        return {
                            errorCode: err.errorCode,
                            httpStatus: err.httpStatus,
                            isRetryable: err.isRetryable,
                        };
                    }
                    return undefined;
                },
            });

            const state = new OrchestratorState({
                isDone: false,
                actions: [[]],
                output: undefined,
                schemaVersion: ReplaySchema.V1,
            });
            const original = new CustomBusinessError("Inventory shortage", "INV_OUT", 409, true);
            const err = new OrchestrationFailureError(original, state);
            const expectedJson = JSON.stringify({
                errorCode: "INV_OUT",
                httpStatus: 409,
                isRetryable: true,
            });
            expect(err.message).to.contain(
                `Inventory shortage${exceptionPropertiesLabel}${expectedJson}`
            );
        });
    });
});
