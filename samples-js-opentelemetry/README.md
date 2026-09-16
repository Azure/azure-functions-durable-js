# Durable Functions OpenTelemetry sample

This sample shows how to send telemetry from a JavaScript Durable Functions app to Application Insights using OpenTelemetry.

The app exposes an HTTP endpoint that starts a `helloSequence` orchestration. The orchestration calls the `sayHello` activity three times, and each activity creates a custom `hello-world.activity.user-span` span.

## Prerequisites

-   Node.js 22 or later
-   Azure Functions Core Tools v4
-   Docker, for running Azurite locally

## Run the sample locally

1. Install the dependencies:

    ```powershell
    npm install
    ```

2. Create the local settings file:

    ```powershell
    Copy-Item local.settings.json.example local.settings.json
    ```

3. Start Azurite in a separate terminal:

    ```powershell
    docker run --rm --name durable-functions-azurite -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite
    ```

4. Start the Functions host:

    ```powershell
    npm start
    ```

5. Run the verification:

    ```powershell
    npm run verify
    ```

The verification sends a known W3C `traceparent` and `tracestate`, waits for the orchestration to complete, and confirms that the same trace context is active in the orchestrator, every activity, and every custom activity span.

When `APPLICATIONINSIGHTS_CONNECTION_STRING` is not configured, the sample writes worker telemetry to the console.

## Send telemetry to Application Insights

Configure these application settings in the Function App:

| Setting                                 | Value                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | The connection string for the Application Insights resource                          |
| `OTEL_SERVICE_NAME`                     | A short name used as the Application Insights cloud role, such as `dfjs-otel-sample` |

Deploy the app and run the verification against its URL:

```powershell
$env:SAMPLE_BASE_URL = "https://<FUNCTION_APP_NAME>.azurewebsites.net"
npm run verify
```

Open the operation matching the trace ID printed by the verification in Application Insights. The trace includes:

```text
HTTP starter
└─ POST /durabletask/orchestrators/helloSequence
   └─ create_orchestration:helloSequence
      └─ orchestration:helloSequence
         ├─ activity:sayHello
         │  └─ activity:sayHello
         │     └─ hello-world.activity.user-span
         ├─ activity:sayHello
         │  └─ activity:sayHello
         │     └─ hello-world.activity.user-span
         └─ activity:sayHello
            └─ activity:sayHello
               └─ hello-world.activity.user-span
```

For more information about configuring OpenTelemetry for JavaScript Azure Functions, see [Use OpenTelemetry with Azure Functions](https://learn.microsoft.com/azure/azure-functions/opentelemetry-howto?pivots=programming-language-javascript&tabs=app-insights).
