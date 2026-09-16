const { AzureFunctionsInstrumentation } = require("@azure/functions-opentelemetry-instrumentation");
const {
    AzureMonitorLogExporter,
    AzureMonitorTraceExporter,
} = require("@azure/monitor-opentelemetry-exporter");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { resourceFromAttributes } = require("@opentelemetry/resources");
const {
    ConsoleLogRecordExporter,
    LoggerProvider,
    SimpleLogRecordProcessor,
} = require("@opentelemetry/sdk-logs");
const { ConsoleSpanExporter, SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");

const resource = resourceFromAttributes({
    "service.name": process.env.OTEL_SERVICE_NAME || "durable-js-otel-sample",
});
const applicationInsightsConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [
        new SimpleSpanProcessor(
            applicationInsightsConnectionString
                ? new AzureMonitorTraceExporter({
                      connectionString: applicationInsightsConnectionString,
                  })
                : new ConsoleSpanExporter()
        ),
    ],
});
tracerProvider.register();

const loggerProvider = new LoggerProvider({
    resource,
    processors: [
        new SimpleLogRecordProcessor(
            applicationInsightsConnectionString
                ? new AzureMonitorLogExporter({
                      connectionString: applicationInsightsConnectionString,
                  })
                : new ConsoleLogRecordExporter()
        ),
    ],
});

registerInstrumentations({
    tracerProvider,
    loggerProvider,
    instrumentations: [getNodeAutoInstrumentations(), new AzureFunctionsInstrumentation()],
});
