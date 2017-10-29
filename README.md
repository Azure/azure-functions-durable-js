# Durable Functions for Node.js

Provides a shim to write your Durable Functions orchestration for Node.js

🚧 This is an early concept and isn't really functional 🚧

## Getting started

1. Install the package

```
<TBD>
```

2. Add shim & generator to your code

```javascript
const df = require('durable-functions');
module.exports = df(function*(context){
    // ... your code here
});
```

3. Write your orchestration logic 
```javascript
yield context.df.callFunction("foo", "bar");
```

## Patterns

### Chaining

Check out the [chain sample](./test/sample/chain/index.js) for the full code:

```javascript
const df = require("../../../lib/");

module.exports = df(function*(context){
    context.log("Starting chain sample");
    const output = [];
    output.push(yield context.df.callFunction("hello", "Tokyo"));
    output.push(yield context.df.callFunction("hello", "Seattle"));
    output.push(yield context.df.callFunction("hello", "London"));

    return output;
});
```

You can test this in the sample by running the sample (`func host start`) and then running a few HTTP requests (use Postman or cURL)

 - POST http://localhost:7071/api/chain  
    body:
    ```json
    {}
    ```
    response:
    ```json
    {
        "isDone": false,
        "state": {},
        "actions": [
            {
                "type": "callFunction",
                "name": "hello",
                "input": "Tokyo"
            }
        ],
        "output": null
    }
    ```
- POST http://localhost:7071/api/chain  
    body:
    ```json
    {
        "hello":{
            "Tokyo":"Hello Tokyo"
        }
    }
    ```
    response:
    ```json
    {
        "isDone": false,
        "state": {
            "hello": {
                "Tokyo": "Hello Tokyo"
            }
        },
        "actions": [
            {
                "type": "callFunction",
                "name": "hello",
                "input": "Seattle"
            }
        ],
        "output": null
    }
    ```
- POST http://localhost:7071/api/chain 
    body:
    ```json
    {
        "hello":{
            "Tokyo":"Hello Tokyo",
            "Seattle":"Hello Seattle"
        }
    }
    ```
    response:
    ```json
    {
        "isDone": false,
        "state": {
            "hello": {
                "Tokyo": "Hello Tokyo",
                "Seattle": "Hello Seattle"
            }
        },
        "actions": [
            {
                "type": "callFunction",
                "name": "hello",
                "input": "London"
            }
        ],
        "output": null
    }
    ```
- POST http://localhost:7071/api/chain  
    body:
    ```json
    {
        "hello":{
            "Tokyo":"Hello Tokyo",
            "Seattle":"Hello Seattle",
            "London":"Hello London"
        }
    }
    ```
    response:
    ```json
    {
        "isDone": true,
        "state": {
            "hello": {
                "Tokyo": "Hello Tokyo",
                "Seattle": "Hello Seattle",
                "London": "Hello London"
            }
        },
        "actions": null,
        "output": [
            "Hello Tokyo",
            "Hello Seattle",
            "Hello London"
        ]
    }
    ```

Note in the final response, we have the `output` property set to all our values. The value that we `return` from our code is set to `output` and `isDone` is set to true.

### Fan out/in

Check out the [fan out/in sample](./test/sample/fanin-out/index.js) for the full code:

```javascript
const df = require("../../../lib/");

module.exports = df(function*(context){
    context.log("Starting chain sample");

    // Fetch files from GetFiles Activity Function
    const files = yield context.df.callFunction("GetFiles");

    // Backup Files and save Promises into array
    const tasks = [];
    for (const file of files) {
        tasks.push(context.df.callFunction("BackupFiles", file));
    }

    // wait for all the Backup Files Activities to complete, sum total bytes
    const results = yield Promise.all(tasks);
    const totalBytes = results.reduce((prev, curr) => prev + curr, 0);

    // return results;
    return totalBytes;
});
```

You can test this in the sample by running the sample (`func host start`) and then running a few HTTP requests (use Postman or cURL)

 - POST http://localhost:7071/api/chain  
    body:
    ```json
    {}
    ```
    response:
    ```json
    {
        "isDone": false,
        "state": {},
        "actions": [
            {
                "type": "callFunction",
                "name": "GetFiles",
                "input": "__activity__default"
            }
        ],
        "output": null
    }
    ```
- POST http://localhost:7071/api/chain  
    body:
    ```json
    {
        "GetFiles":{
            "__activity__default":["file1","file2","file3"]
        }
    }
    ```
    response:
    ```json
    {
        "isDone": false,
        "state": {
            "GetFiles": {
                "__activity__default": [
                    "file1",
                    "file2",
                    "file3"
                ]
            }
        },
        "actions": [
            {
                "type": "callFunction",
                "name": "BackupFiles",
                "input": "file1"
            },
            {
                "type": "callFunction",
                "name": "BackupFiles",
                "input": "file2"
            },
            {
                "type": "callFunction",
                "name": "BackupFiles",
                "input": "file3"
            }
        ],
        "output": null
    }
    ```
    Note that we have multiple Actions now, since we yield'd on a `Promise.all` call. We can use common `Promise` patterns like `Promise.all` and `Promise.race`.
 - POST http://localhost:7071/api/chain  
    body:
    ```json
    {
        "GetFiles":{
            "__activity__default":["file1","file2","file3"]
        },
        "BackupFiles":{
            "file1":50,
            "file2":60,
            "file3":100
        }
    }
    ```
    response:
    ```json
    {
        "isDone": true,
        "state": {
            "GetFiles": {
                "__activity__default": [
                    "file1",
                    "file2",
                    "file3"
                ]
            },
            "BackupFiles": {
                "file1": 50,
                "file2": 60,
                "file3": 100
            }
        },
        "actions": null,
        "output": 210
    }
    ```

Now our output is the result of the `reduce` statement which sums all our bytes we returned from `BackupFiles`.

## How it works

The Durable Functions orchestration trigger sends an object with all the state for a given instance to your Function. The shim takes that state object and lets you express the workflow as a generator, using yield where you want to wait for state to come back. Yield expects a Promise which will resolve `Action` or `StateItem` objects, or an array of said objects. If there are any Action items resolved, the shim will then return back to the Functions runtime the Action items to be done and call the Function again when there is an update.