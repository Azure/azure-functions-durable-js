| Branch | Status                                                                                                                                                                                                                                    | Support level | Programming model | Node.js versions |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------- | ---------------- |
| v2.x   | [![Build Status](https://azfunc.visualstudio.com/Azure%20Functions/_apis/build/status/Azure.azure-functions-durable-js?branchName=v2.x)](https://azfunc.visualstudio.com/Azure%20Functions/_build/latest?definitionId=13&branchName=v2.x) | GA            | V3                | 14.x+            |

# Durable Functions for Node.js

The `durable-functions` npm package allows you to write [Durable Functions](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview) for [Node.js](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node). Durable Functions is an extension of [Azure Functions](https://docs.microsoft.com/en-us/azure/azure-functions/functions-overview) that lets you write stateful functions and workflows in a serverless environment. The extension manages state, checkpoints, and restarts for you. Durable Functions' advantages include:

-   Define workflows in code. No JSON schemas or designers are needed.
-   Call other functions synchronously and asynchronously. Output from called functions can be saved to local variables.
-   Automatically checkpoint progress whenever the function schedules async work. Local state is never lost if the process recycles or the VM reboots.

You can find more information at the following links:

-   [Azure Functions overview](https://docs.microsoft.com/en-us/azure/azure-functions/functions-overview)
-   [Azure Functions JavaScript developers guide](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
-   [Durable Functions overview](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview)

A durable function, or _orchestration_, is a solution made up of different types of Azure Functions:

-   **Activity:** the functions and tasks being orchestrated by your workflow.
-   **Orchestrator:** a function that describes the way and order actions are executed in code.
-   **Client:** the entry point for creating an instance of a durable orchestration.

Durable Functions' function types and features are documented in-depth [here.](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-types-features-overview)

Version `2.x` of the Durable Functions package supports the legacy v3 Node.js programming model for Azure Functions. Compared to the v3 model, the v4 model is designed to have a more intuitive and flexible experience for JavaScript and TypeScript developers. To use the v4 model, please switch to `v3.x` of the Durable Functions package.

## Getting Started

You can follow the [Visual Studio Code quickstart](https://docs.microsoft.com/en-us/azure/azure-functions/durable/quickstart-js-vscode) to get started with a function chaining example, or follow the general checklist below:

1. Install prerequisites:

    - [Azure Functions Core Tools version 4.x](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local#install-the-azure-functions-core-tools)
    - [Azure Storage Emulator](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-emulator) (Windows) or an actual Azure storage account (Mac or Linux)
    - Node.js 14.x or later

2. [Create an Azure Functions app.](https://docs.microsoft.com/en-us/azure/azure-functions/functions-create-first-function-vs-code) [Visual Studio Code's Azure Functions plugin](https://code.visualstudio.com/tutorials/functions-extension/getting-started) is recommended.

3. Install the Durable Functions extension

Run this command from the root folder of your Azure Functions app:

```bash
func extensions install -p Microsoft.Azure.WebJobs.Extensions.DurableTask -v 1.8.3
```

**durable-functions requires Microsoft.Azure.WebJobs.Extensions.DurableTask 1.8.3 or greater.**

4. Install the `durable-functions` npm package at the root of your function app:

```bash
npm install durable-functions@2
```

5. Write an activity function ([see sample](./samples/E1_SayHello)):

```javascript
module.exports = async function (context) {
    // your code here
};
```

6. Write an orchestrator function ([see sample](./samples/E1_HelloSequence)):

```javascript
const df = require("durable-functions");
module.exports = df.orchestrator(function* (context) {
    // your code here
});
```

**Note:** Orchestrator functions must follow certain [code constraints.](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-checkpointing-and-replay#orchestrator-code-constraints)

7. Write your client function ([see sample](./samples/HttpStart/)):

```javascript
module.exports = async function (context, req) {
    const client = df.getClient(context);
    const instanceId = await client.startNew(req.params.functionName, undefined, req.body);

    context.log(`Started orchestration with ID = '${instanceId}'.`);

    return client.createCheckStatusResponse(context.bindingData.req, instanceId);
};
```

**Note:** Client functions are started by a trigger binding available in the Azure Functions 2.x major version. [Read more about trigger bindings and 2.x-supported bindings.](https://docs.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings#overview)

## Samples

The [Durable Functions samples](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-install) demonstrate several common use cases. They are located in the [samples directory.](./samples/) Descriptive documentation is also available:

-   [Function Chaining - Hello Sequence](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-sequence)
-   [Fan-out/Fan-in - Cloud Backup](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-cloud-backup)
-   [Monitors - Weather Watcher](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-monitor)
-   [Human Interaction & Timeouts - Phone Verification](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-phone-verification)

```javascript
const df = require("durable-functions");

module.exports = df.orchestrator(function* (context) {
    context.log("Starting chain sample");
    const output = [];
    output.push(yield context.df.callActivity("E1_SayHello", "Tokyo"));
    output.push(yield context.df.callActivity("E1_SayHello", "Seattle"));
    output.push(yield context.df.callActivity("E1_SayHello", "London"));

    return output;
});
```

## How it works

### Durable Functions

One of the key attributes of Durable Functions is reliable execution. Orchestrator functions and activity functions may be running on different VMs within a data center, and those VMs or the underlying networking infrastructure is not 100% reliable.

In spite of this, Durable Functions ensures reliable execution of orchestrations. It does so by using storage queues to drive function invocation and by periodically checkpointing execution history into storage tables (using a cloud design pattern known as [Event Sourcing](https://docs.microsoft.com/azure/architecture/patterns/event-sourcing)). That history can then be replayed to automatically rebuild the in-memory state of an orchestrator function.

[Read more about Durable Functions' reliable execution.](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-checkpointing-and-replay)

### Durable Functions JS

The `durable-functions` shim lets you express a workflow in code as a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators) wrapped by a call to the `orchestrator` method. `orchestrator` treats `yield`-ed calls to your function `context`'s `df` object, like `context.df.callActivity`, as points where you want to schedule an asynchronous unit of work and wait for it to complete.

These calls return a `Task` or `TaskSet` object signifying the outstanding work. The `orchestrator` method appends the action(s) of the `Task` or `TaskSet` object to a list which it passes back to the Functions runtime, plus whether the function is completed, and any output or errors.

The Azure Functions extension schedules the desired actions. When the actions complete, the extension triggers the orchestrator function to replay up to the next incomplete asynchronous unit of work or its end, whichever comes first.
