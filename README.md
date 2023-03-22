| Branch | Support level | Status                                                                                                                                                                                                                                    |
| ------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2.x   | GA            | [![Build Status](https://azfunc.visualstudio.com/Azure%20Functions/_apis/build/status/Azure.azure-functions-durable-js?branchName=v2.x)](https://azfunc.visualstudio.com/Azure%20Functions/_build/latest?definitionId=13&branchName=v2.x) |
| v3.x   | Preview       | [![Build Status](https://azfunc.visualstudio.com/Azure%20Functions/_apis/build/status/Azure.azure-functions-durable-js?branchName=v3.x)](https://azfunc.visualstudio.com/Azure%20Functions/_build/latest?definitionId=13&branchName=v3.x) |

# Durable Functions for Node.js

The `durable-functions` npm package allows you to write [Durable Functions](https://docs.microsoft.com/azure/azure-functions/durable/durable-functions-overview?tabs=javascript-v4) for [Node.js](https://docs.microsoft.com/azure/azure-functions/functions-reference-node?pivots=nodejs-model-v4). Durable Functions is an extension of [Azure Functions](https://docs.microsoft.com/azure/azure-functions/functions-overview) that lets you write stateful functions and workflows in a serverless environment. The extension manages state, checkpoints, and restarts for you. Durable Functions' advantages include:

-   Define workflows in code. No JSON schemas or designers are needed.
-   Call other functions synchronously and asynchronously. Output from called functions can be saved to local variables.
-   Automatically checkpoint progress whenever the function schedules async work. Local state is never lost if the process recycles or the VM reboots.

You can find more information at the following links:

-   [Azure Functions overview](https://docs.microsoft.com/azure/azure-functions/functions-overview)
-   [Azure Functions JavaScript developers guide](https://docs.microsoft.com/azure/azure-functions/functions-reference-node?pivots=nodejs-model-v4)
-   [Durable Functions overview](https://docs.microsoft.com/azure/azure-functions/durable/durable-functions-overview?tabs=javascript-v4)

A durable function, or _orchestration_, is a solution made up of different types of Azure Functions:

-   **Activity:** the functions and tasks being orchestrated by your workflow.
-   **Orchestrator:** a function that describes the way and order actions are executed in code.
-   **Client:** the entry point for creating an instance of a durable orchestration.

Durable Functions' function types and features are documented in-depth [here.](https://docs.microsoft.com/azure/azure-functions/durable/durable-functions-types-features-overview)

This preview `v3.x` version of the Durable Functions package supports the new v4 Node.js programming model for Azure Functions, currently in preview! Compared to the current v3 model, the v4 model is designed to have a more idiomatic and intuitive experience for JavaScript and TypeScript developers. You can learn more about the v4 programming model at the following links:

-   [Azure Functions Node.js Developer Guide](https://docs.microsoft.com/azure/azure-functions/functions-reference-node?pivots=nodejs-model-v4)
-   [Node.js v4 programming model upgrade guide](https://learn.microsoft.com/azure/azure-functions/functions-node-upgrade-v4)

## Getting Started

You can follow the Visual Studio Code quickstart in [JavaScript](https://docs.microsoft.com/azure/azure-functions/durable/quickstart-js-vscode?pivots=nodejs-model-v4) or [TypeScript](https://docs.microsoft.com/azure/azure-functions/durable/quickstart-ts-vscode?pivots=nodejs-model-v4) to get started with a function chaining example, or follow the general checklist below:

1. Install prerequisites:

    - [Azure Functions Core Tools version 4.0.5085 (or higher)](https://learn.microsoft.com/azure/azure-functions/functions-run-local?tabs=v4%2Cwindows%2Cnode%2Cportal%2Cbash#install-the-azure-functions-core-tools)
    - [Azurite emulator](https://learn.microsoft.com/azure/storage/common/storage-use-azurite) or an actual Azure storage account
    - Node.js 18.x or later

2. [Create an Azure Functions app.](https://learn.microsoft.com/azure/azure-functions/create-first-function-vs-code-node?pivots=nodejs-model-v4) [Visual Studio Code's Azure Functions extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions) is recommended ([version 1.10.4](https://github.com/microsoft/vscode-azurefunctions/releases/tag/v1.10.4) or above is needed for the v4 programming model).

3. Install the Durable Functions extension

We recommend using Azure Functions [extension bundles](https://learn.microsoft.com/azure/azure-functions/functions-bindings-register#extension-bundles) to install the Durable Functions extension. Version 3.15 or higher of extension bundles is required for the v4 programming model. Make sure you add the following in your `host.json` file:

```json
"extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[3.15.0, 4.0.0)"
}
```

4. Install the `durable-functions` npm package (preview version) at the root of your function app:

```bash
npm install durable-functions@preview
```

5. Write an activity function (see sample in [JavaScript](./samples-js/functions/sayHello.js#L37)/[TypeScript](./samples-ts/functions/sayHello.ts#L44)):

```javascript
const df = require("durable-functions");
df.app.activity("myActivity", {
    handler: async function (context) {
        // your code here
    },
});
```

6. Write an orchestrator function (see sample in [JavaScript](./samples-js/functions/sayHello.js#L5)/[TypeScript](./samples-ts/functions/sayHello.ts#L6)):

```javascript
const df = require("durable-functions");
df.app.orchestration("myOrchestration", function* (context) {
    // your code here
});
```

**Note:** Orchestrator functions must follow certain [code constraints.](https://docs.microsoft.com/azure/azure-functions/durable-functions-checkpointing-and-replay#orchestrator-code-constraints)

7. Write your client function (see sample in [JavaScript](./samples-js/functions/httpStart.js)/[TypeScript](./samples-ts/functions/httpStart.ts)):

```javascript
const df = require("durable-functions");
const { app } = require("@azure/functions");

app.http("httpStart", {
    route: "orchestrators/{orchestratorName}",
    extraInputs: [df.input.durableClient()],
    handler: async (request, context) => {
        const client = df.getClient(context);
        const body = await request.json();
        const instanceId = await client.startNew(request.params.orchestratorName, { input: body });

        context.log(`Started orchestration with ID = '${instanceId}'.`);

        return client.createCheckStatusResponse(request, instanceId);
    },
});
```

**Note:** Client functions can be started by any trigger binding supported in the Azure Functions runtime version 2.x+. Node.js v4 programming model apps require at least version 4.16.5 of the Azure Functions runtime. [Read more about trigger bindings and 2.x-supported bindings.](https://docs.microsoft.com/azure/azure-functions/functions-triggers-bindings#overview)

## Samples

The [Durable Functions samples](https://docs.microsoft.com/azure/azure-functions/durable-functions-install) demonstrate several common use cases. They are located in the samples directories ([JavaScript](./samples-js/)/[TypeScript](./samples-ts/)). Descriptive documentation is also available:

-   [Function Chaining - Hello Sequence](https://docs.microsoft.com/azure/azure-functions/durable-functions-sequence?tabs=javascript-v4)
-   [Fan-out/Fan-in - Cloud Backup](https://docs.microsoft.com/azure/azure-functions/durable-functions-cloud-backup?tabs=javascript-v4)
-   [Monitors - Weather Watcher](https://docs.microsoft.com/azure/azure-functions/durable-functions-monitor?tabs=javascript)
-   [Human Interaction & Timeouts - Phone Verification](https://docs.microsoft.com/azure/azure-functions/durable-functions-phone-verification?tabs=javascript-v4)

```javascript
const df = require("durable-functions");

const helloActivityName = "sayHello";

df.app.orchestration("helloSequence", function* (context) {
    context.log("Starting chain sample");

    const output = [];
    output.push(yield context.df.callActivity(helloActivityName, "Tokyo"));
    output.push(yield context.df.callActivity(helloActivityName, "Seattle"));
    output.push(yield context.df.callActivity(helloActivityName, "Cairo"));

    return output;
});
```

## How it works

### Durable Functions

One of the key attributes of Durable Functions is reliable execution. Orchestrator functions and activity functions may be running on different VMs within a data center, and those VMs or the underlying networking infrastructure is not 100% reliable.

In spite of this, Durable Functions ensures reliable execution of orchestrations. It does so by using storage queues to drive function invocation and by periodically checkpointing execution history into storage tables (using a cloud design pattern known as [Event Sourcing](https://docs.microsoft.com/azure/architecture/patterns/event-sourcing)). That history can then be replayed to automatically rebuild the in-memory state of an orchestrator function.

[Read more about Durable Functions' reliable execution.](https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-orchestrations?tabs=javascript-v4)

### Durable Functions JS

The `durable-functions` shim lets you express a workflow in code as a [generator function](https://developer.mozilla.org/docs/Web/JavaScript/Guide/Iterators_and_Generators) wrapped by a call to the `app.orchestration` method. The Durable Functions SDK treats `yield`-ed calls to your function `context`'s `df` object, like `context.df.callActivity`, as points where you want to schedule an asynchronous unit of work and wait for it to complete.

These calls return a `Task` object signifying the outstanding work. The SDK appends the action(s) of the `Task` object to a list which it passes back to the Functions runtime, plus whether the function is completed, and any output or errors.

The Azure Functions extension schedules the desired actions. When the actions complete, the extension triggers the orchestrator function to replay up to the next incomplete asynchronous unit of work or its end, whichever comes first.
