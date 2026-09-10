import { TraceContext } from "@azure/functions";
import OpenTelemetryApi = require("@opentelemetry/api");

const reportedDiagnostics = new Set<string>();
const traceParentPattern = /^((?!ff)[0-9a-f]{2})-((?!0{32})[0-9a-f]{32})-((?!0{16})[0-9a-f]{16})-([0-9a-f]{2})(-.*)?$/;
const simpleTraceStateKeyPattern = /^[a-z][a-z0-9_\-*/]{0,255}$/;
const multiTenantTraceStateKeyPattern = /^[a-z0-9][a-z0-9_\-*/]{0,240}@[a-z][a-z0-9_\-*/]{0,13}$/;
const traceStateValuePattern = /^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255}[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/;

export function getValidActiveContext(): OpenTelemetryApi.Context | undefined {
    const activeContext = OpenTelemetryApi.context.active();
    const spanContext = OpenTelemetryApi.trace.getSpanContext(activeContext);

    return spanContext && OpenTelemetryApi.trace.isSpanContextValid(spanContext)
        ? activeContext
        : undefined;
}

export function extractInvocationTraceContext(
    invocationTraceContext: TraceContext | undefined,
    baseContext: OpenTelemetryApi.Context = OpenTelemetryApi.ROOT_CONTEXT
): OpenTelemetryApi.Context | undefined {
    const carrier = getInvocationTraceContextHeaders(invocationTraceContext);
    if (!carrier.traceparent) {
        return undefined;
    }

    const extractedContext = OpenTelemetryApi.propagation.extract(baseContext, carrier);
    const spanContext = OpenTelemetryApi.trace.getSpanContext(extractedContext);
    if (!spanContext || !OpenTelemetryApi.trace.isSpanContextValid(spanContext)) {
        reportDiagnosticOnce(
            "extract",
            "Durable Functions could not extract InvocationContext.traceContext. Ensure it contains a valid W3C traceparent and that a W3C Trace Context propagator is registered."
        );
        return undefined;
    }

    return extractedContext;
}

export function getInvocationTraceContextHeaders(
    invocationTraceContext: TraceContext | undefined
): Record<string, string> {
    const traceParent = invocationTraceContext?.traceParent?.trim();
    if (!traceParent) {
        return {};
    }

    const match = traceParentPattern.exec(traceParent);
    if (!match || (match[1] === "00" && match[5])) {
        reportDiagnosticOnce(
            "validate",
            "Durable Functions ignored an invalid W3C traceparent in InvocationContext.traceContext."
        );
        return {};
    }

    const headers: Record<string, string> = { traceparent: traceParent };
    const traceState = invocationTraceContext?.traceState?.trim();
    if (traceState) {
        if (isValidTraceState(traceState)) {
            headers.tracestate = traceState;
        } else {
            reportDiagnosticOnce(
                "tracestate",
                "Durable Functions ignored an invalid W3C tracestate in InvocationContext.traceContext."
            );
        }
    }

    return headers;
}

export function runWithInvocationTraceContext<T>(
    invocationTraceContext: TraceContext | undefined,
    callback: () => T
): T {
    if (getValidActiveContext()) {
        return callback();
    }

    const extractedContext = extractInvocationTraceContext(
        invocationTraceContext,
        OpenTelemetryApi.context.active()
    );
    if (!extractedContext) {
        return callback();
    }

    const expectedSpanContext = OpenTelemetryApi.trace.getSpanContext(extractedContext);
    return OpenTelemetryApi.context.with(extractedContext, () => {
        const activeSpanContext = OpenTelemetryApi.trace.getSpanContext(
            OpenTelemetryApi.context.active()
        );
        if (
            !expectedSpanContext ||
            !activeSpanContext ||
            activeSpanContext.traceId !== expectedSpanContext.traceId ||
            activeSpanContext.spanId !== expectedSpanContext.spanId
        ) {
            reportDiagnosticOnce(
                "activate",
                "Durable Functions could not activate InvocationContext.traceContext. Ensure a functional asynchronous OpenTelemetry context manager is registered."
            );
        }

        return callback();
    });
}

function isValidTraceState(traceState: string): boolean {
    if (traceState.length > 512) {
        return false;
    }

    const members = traceState.split(",");
    if (members.length > 32) {
        return false;
    }

    const keys = new Set<string>();
    return members.every((member) => {
        const trimmedMember = member.trim();
        if (!trimmedMember) {
            return true;
        }

        const separatorIndex = trimmedMember.indexOf("=");
        if (separatorIndex <= 0 || separatorIndex !== trimmedMember.lastIndexOf("=")) {
            return false;
        }

        const key = trimmedMember.slice(0, separatorIndex);
        const value = trimmedMember.slice(separatorIndex + 1).trimStart();
        if (
            keys.has(key) ||
            (!simpleTraceStateKeyPattern.test(key) && !multiTenantTraceStateKeyPattern.test(key)) ||
            !traceStateValuePattern.test(value)
        ) {
            return false;
        }

        keys.add(key);
        return true;
    });
}

function reportDiagnosticOnce(key: string, message: string): void {
    if (!reportedDiagnostics.has(key)) {
        reportedDiagnostics.add(key);
        OpenTelemetryApi.diag.warn(message);
    }
}
