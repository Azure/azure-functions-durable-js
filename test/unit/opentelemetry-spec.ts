import { InvocationContext, TraceContext } from "@azure/functions";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import OpenTelemetryApi = require("@opentelemetry/api");
import { expect } from "chai";
import "mocha";
import * as moment from "moment";
import nock = require("nock");
import { wrapActivityHandler } from "../../src/app";
import { Constants } from "../../src/Constants";
import { DurableClient } from "../../src/durableClient/DurableClient";
import { getClient } from "../../src/durableClient/getClient";
import {
    runWithInvocationTraceContext,
    extractInvocationTraceContext,
    getInvocationTraceContextHeaders,
} from "../../src/util/OpenTelemetryUtils";
import {
    createOrchestrator,
    DummyOrchestrationContext,
    DurableOrchestrationInput,
} from "../../src/util/testingUtils";
import { input } from "../../src";
import { TestConstants } from "../testobjects/testconstants";
import { TestHistories } from "../testobjects/testhistories";
import { TestUtils } from "../testobjects/testutils";

describe("OpenTelemetry context propagation", () => {
    const invocationTraceParent = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
    const invocationTraceState = "vendor=value";
    const invocationTraceContext: TraceContext = {
        traceParent: invocationTraceParent,
        traceState: invocationTraceState,
    };
    const activeTraceParent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const clientInputData = TestUtils.createOrchestrationClientInputData(
        TestConstants.idPlaceholder,
        Constants.DefaultLocalOrigin
    );
    let contextManager: AsyncLocalStorageContextManager;

    before(() => {
        if (!nock.isActive()) {
            nock.activate();
        }
    });

    after(() => {
        nock.restore();
    });

    beforeEach(() => {
        OpenTelemetryApi.context.disable();
        OpenTelemetryApi.propagation.disable();
        contextManager = new AsyncLocalStorageContextManager().enable();
        expect(OpenTelemetryApi.context.setGlobalContextManager(contextManager)).to.equal(true);
        expect(
            OpenTelemetryApi.propagation.setGlobalPropagator(new W3CTraceContextPropagator())
        ).to.equal(true);
    });

    afterEach(() => {
        nock.cleanAll();
        OpenTelemetryApi.context.disable();
        OpenTelemetryApi.propagation.disable();
        contextManager.disable();
    });

    it("injects invocation trace context when startNew has no active span", async () => {
        const client = new DurableClient(clientInputData, invocationTraceContext);
        const scope = nock(Constants.DefaultLocalOrigin)
            .matchHeader("traceparent", invocationTraceParent)
            .matchHeader("tracestate", invocationTraceState)
            .post(/.*/)
            .reply(202, { id: "instance-id" });

        expect(await client.startNew("orchestrator")).to.equal("instance-id");
        expect(scope.isDone()).to.equal(true);
    });

    it("passes invocation trace context from getClient to startNew", async () => {
        const clientInput = input.durableClient();
        const invocationContext = new InvocationContext({
            options: { extraInputs: [clientInput] },
            traceContext: invocationTraceContext,
        });
        invocationContext.extraInputs.set(clientInput, clientInputData);
        const scope = nock(Constants.DefaultLocalOrigin)
            .matchHeader("traceparent", invocationTraceParent)
            .post(/.*/)
            .reply(202, { id: "instance-id" });

        expect(await getClient(invocationContext).startNew("orchestrator")).to.equal("instance-id");
        expect(scope.isDone()).to.equal(true);
    });

    it("injects invocation trace context without a registered global propagator", async () => {
        OpenTelemetryApi.propagation.disable();
        const client = new DurableClient(clientInputData, invocationTraceContext);
        const scope = nock(Constants.DefaultLocalOrigin)
            .matchHeader("traceparent", invocationTraceParent)
            .matchHeader("tracestate", invocationTraceState)
            .post(/.*/)
            .reply(202, { id: "instance-id" });

        expect(await client.startNew("orchestrator")).to.equal("instance-id");
        expect(scope.isDone()).to.equal(true);
    });

    it("accepts valid future traceparent versions", () => {
        const futureTraceParent = "01-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01-future";

        expect(getInvocationTraceContextHeaders({ traceParent: futureTraceParent })).to.deep.equal({
            traceparent: futureTraceParent,
        });
    });

    it("omits malformed tracestate without dropping a valid traceparent", () => {
        for (const traceState of [
            "duplicate=value,duplicate=other",
            `oversized=${"x".repeat(513)}`,
            "invalid",
        ]) {
            expect(
                getInvocationTraceContextHeaders({
                    traceParent: invocationTraceParent,
                    traceState,
                })
            ).to.deep.equal({ traceparent: invocationTraceParent });
        }
    });

    it("preserves valid numeric-leading multi-tenant tracestate keys", () => {
        expect(
            getInvocationTraceContextHeaders({
                traceParent: invocationTraceParent,
                traceState: "1tenant@vendor=value",
            })
        ).to.deep.equal({
            traceparent: invocationTraceParent,
            tracestate: "1tenant@vendor=value",
        });
    });

    it("preserves W3C tracestate with empty list members", () => {
        expect(
            getInvocationTraceContextHeaders({
                traceParent: invocationTraceParent,
                traceState: "vendor=value,",
            })
        ).to.deep.equal({
            traceparent: invocationTraceParent,
            tracestate: "vendor=value,",
        });
    });

    it("prefers a valid active span over invocation trace context", async () => {
        const client = new DurableClient(clientInputData, invocationTraceContext);
        const activeContext = extractInvocationTraceContext({ traceParent: activeTraceParent });
        if (!activeContext) {
            throw new Error("Expected active trace context to be extracted.");
        }
        const scope = nock(Constants.DefaultLocalOrigin)
            .matchHeader("traceparent", activeTraceParent)
            .post(/.*/)
            .reply(202, { id: "instance-id" });

        await OpenTelemetryApi.context.with(activeContext, async () => {
            await client.startNew("orchestrator");
        });

        expect(scope.isDone()).to.equal(true);
    });

    it("activates invocation context across awaited activity work and restores the prior scope", async () => {
        const invocationContext = new InvocationContext({
            traceContext: invocationTraceContext,
        });
        const wrapped = wrapActivityHandler(async () => {
            expectActiveSpan("b7ad6b7169203331");
            await Promise.resolve();
            expectActiveSpan("b7ad6b7169203331");
            return "done";
        });

        expect(await wrapped(undefined, invocationContext)).to.equal("done");
        expect(OpenTelemetryApi.trace.getSpanContext(OpenTelemetryApi.context.active())).to.equal(
            undefined
        );
    });

    it("preserves an existing active span around activity work", async () => {
        const invocationContext = new InvocationContext({
            traceContext: invocationTraceContext,
        });
        const activeContext = extractInvocationTraceContext({ traceParent: activeTraceParent });
        if (!activeContext) {
            throw new Error("Expected active trace context to be extracted.");
        }
        const wrapped = wrapActivityHandler(async () => {
            await Promise.resolve();
            expectActiveSpan("00f067aa0ba902b7");
        });

        await OpenTelemetryApi.context.with(activeContext, async () => {
            await wrapped(undefined, invocationContext);
        });
    });

    it("preserves active non-span OpenTelemetry state during fallback activation", async () => {
        const baggage = OpenTelemetryApi.propagation.createBaggage({
            tenant: { value: "alpha" },
        });
        const baggageContext = OpenTelemetryApi.propagation.setBaggage(
            OpenTelemetryApi.ROOT_CONTEXT,
            baggage
        );

        await OpenTelemetryApi.context.with(baggageContext, async () => {
            await runWithInvocationTraceContext(invocationTraceContext, async () => {
                await Promise.resolve();
                expect(
                    OpenTelemetryApi.propagation
                        .getBaggage(OpenTelemetryApi.context.active())
                        ?.getEntry("tenant")?.value
                ).to.equal("alpha");
                expectActiveSpan("b7ad6b7169203331");
            });
        });
    });

    it("isolates concurrent activity invocation contexts", async () => {
        const secondTraceContext: TraceContext = {
            traceParent: "00-1af7651916cd43dd8448eb211c80319c-c7ad6b7169203332-01",
        };
        let releaseFirst: () => void = () => undefined;
        const firstCanFinish = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });
        const first = runWithInvocationTraceContext(invocationTraceContext, async () => {
            await firstCanFinish;
            return activeSpanId();
        });
        const second = runWithInvocationTraceContext(secondTraceContext, async () => {
            await Promise.resolve();
            const spanId = activeSpanId();
            releaseFirst();
            return spanId;
        });

        expect(await Promise.all([first, second])).to.deep.equal([
            "b7ad6b7169203331",
            "c7ad6b7169203332",
        ]);
    });

    it("runs the handler without context when invocation trace context is malformed", async () => {
        const result = await runWithInvocationTraceContext({ traceParent: "invalid" }, async () => {
            await Promise.resolve();
            return OpenTelemetryApi.trace.getSpanContext(OpenTelemetryApi.context.active());
        });

        expect(result).to.equal(undefined);
    });

    it("runs the handler without context when no functional context manager is registered", async () => {
        OpenTelemetryApi.context.disable();

        const result = await runWithInvocationTraceContext(invocationTraceContext, async () => {
            await Promise.resolve();
            return OpenTelemetryApi.trace.getSpanContext(OpenTelemetryApi.context.active());
        });

        expect(result).to.equal(undefined);
    });

    it("restores the prior scope when activity work rejects", async () => {
        const expectedError = new Error("activity failed");

        try {
            await runWithInvocationTraceContext(invocationTraceContext, async () => {
                await Promise.resolve();
                throw expectedError;
            });
            expect.fail("Expected activity work to reject.");
        } catch (error) {
            expect(error).to.equal(expectedError);
        }

        expect(OpenTelemetryApi.trace.getSpanContext(OpenTelemetryApi.context.active())).to.equal(
            undefined
        );
    });

    it("activates invocation context around orchestrator execution", async () => {
        let orchestratorSpanId: string | undefined;
        const orchestrator = createOrchestrator(function* () {
            orchestratorSpanId = activeSpanId();
            return "done";
        });
        const invocationContext = new DummyOrchestrationContext();
        invocationContext.traceContext = invocationTraceContext;
        const orchestrationInput = new DurableOrchestrationInput(
            "",
            TestHistories.StarterHistory(moment.utc().toDate())
        );

        await orchestrator(orchestrationInput, invocationContext);

        expect(orchestratorSpanId).to.equal("b7ad6b7169203331");
    });

    function expectActiveSpan(expectedSpanId: string): void {
        expect(activeSpanId()).to.equal(expectedSpanId);
    }

    function activeSpanId(): string | undefined {
        return OpenTelemetryApi.trace.getSpanContext(OpenTelemetryApi.context.active())?.spanId;
    }
});
