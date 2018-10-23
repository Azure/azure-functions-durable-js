# Durable Functions for Node.js

This library provides a shim to write your [Durable Functions](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-overview) orchestrator functions in [Node.js](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node), using Durable's out-of-proc execution protocol. **JS orchestrators have the same [code constraints](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-checkpointing-and-replay#orchestrator-code-constraints) as C# orchestrators.**

🚧 This library currently in **public preview** status. 🚧

Not all functionality has been implemented yet and there may be significant changes to both this library and the protocol.

## Getting Started

1. Install Durable Functions

Run this command from the root folder of your functions app:
```
func extensions install -p Microsoft.Azure.WebJobs.Extensions.DurableTask -v 1.6.2
```

2. Install the package

```bash
npm install durable-functions
```

3. Add the shim library and generator to your code:

```javascript
const df = require('durable-functions');
module.exports = df.orchestrator(function*(context){
    // ... your code here
});
```

4. Write your orchestration logic :
```javascript
yield context.df.callActivity("foo", "bar");
```

5. Write your [orchestration starter](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-instance-management#starting-instances):
```javascript
module.exports = function (context, input) {
    var id = generateSomeUniqueId();
    context.bindings.starter = [{
        FunctionName: "HelloWorld",
        Input: input,
        InstanceId: id
    }];

    context.done(null);
};
```

## Samples

The [Durable Functions samples](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-install) demonstrate the documentated Durable Functions patterns. They have been translated into JavaScript and are located in the [samples directory.](./test/sample/) The JavaScript versions will be added to the official documentation as a general release approaches. For now, some docs show C# samples only, but all explain the patterns in greater depth:

* [Function Chaining - Hello Sequence](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-sequence)
* [Fan-out/Fan-in - Cloud Backup](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-cloud-backup)
* [Monitors - Weather Watcher](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-monitor)
* [Human Interaction & Timeouts - Phone Verification](https://docs.microsoft.com/en-us/azure/azure-functions/durable-functions-phone-verification)

```javascript
const df = require("durable-functions");

module.exports = df.orchestrator(function*(context){
    context.log("Starting chain sample");
    const output = [];
    output.push(yield context.df.callActivity("E1_SayHello", "Tokyo"));
    output.push(yield context.df.callActivity("E1_SayHello", "Seattle"));
    output.push(yield context.df.callActivity("E1_SayHello", "London"));

    return output;
});
```

## How it works

Recall that Durable Functions uses an append-only execution history to rebuild state on each execution. The Durable Functions orchestration trigger sends an object with the history for a given orchestration instance to your function. The shim library takes that state object and lets you express the workflow as a generator, using `yield` where you want to wait for state to come back. `yield` expects a Promise which will resolve a `Task` or `TaskSet` object. The shim will append the action(s) of the `Task` or `TaskSet` object to a list which it passes back to the Functions runtime, plus whether the function is completed and any output. The extension will call the Function again when there is an update.

## API Comparison

The shim strives to hew closely to the C# DurableOrchestrationContext API, while feeling natural to Node developers. In general, DurableOrchestrationContext methods and properties are accessed from the `context.df` object, are camel-cased, and take the same arguments as their C# counterparts. Major differences:

* `yield` awaits an async operation.
* Non-awaited calls to `context.df` methods return a `Task` object which has `all(Task[] tasks)` and `any(Task[] tasks)` methods, analogous to C#'s Task's WhenAll() and WhenAny() methods.
* All CreateTimer calls can be cancelled by calling `cancel()` on the returned `TimerTask` object.

### API Implementation Checklist
**Implemented**
* `CurrentUtcDateTime`
* `CallActivityAsync(String name, Object input)`
* `CreateTimer(Date fireAt)`
* `GetInput()`
* `WaitForExternalEvent(String name)`
* `OrchestrationClient` binding to `string`

**Not Yet Implemented**
* `InstanceId`
* `IsReplaying`
* `CallActivityWithRetryAsync(String, RetryOptions, Object)`
* `CallSubOrchestratorAsync(String, Object)`
* `CallSubOrchestratorAsync(String, String, Object)`
* `CallSubOrchestratorWithRetryAsync(String, RetryOptions, Object)`
* `CallSubOrchestratorWithRetryAsync(String, RetryOptions, String, Object)`
* `ContinueAsNew(Object)`

* `DurableOrchestrationClient` API

**Will Not Be Implemented**
* `CallActivityAsync<TResult>(String, Object)`
* `CallActivityWithRetryAsync<TResult>(String, RetryOptions, Object)`
* `CallSubOrchestratorAsync<TResult>(String, Object)`
* `CallSubOrchestratorAsync<TResult>(String, String, Object)`
* `CallSubOrchestratorWithRetryAsync<TResult>(String, RetryOptions, Object)`
* `CallSubOrchestratorWithRetryAsync<TResult>(String, RetryOptions, String, Object)`
* `CreateTimer<T>(DateTime, T, CancellationToken)`
