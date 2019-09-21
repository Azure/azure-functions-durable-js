import * as df from "../../src";
import { EntityState, DurableEntityBindingInfo, RequestMessage, OperationResult } from "../../src/classes";
import { CounterOperation, EntityInputsAndOutputs, StringStoreOperation  } from "../testobjects/testentityoperations";


export class TestEntityBatches {

    public static GetStringStoreBatch(operations: StringStoreOperation[], existingState: string): EntityInputsAndOutputs {
        let id = new df.EntityId("stringstore", "stringstorekey");

        let entityExists = existingState != null;
        const output = new EntityState([],[]);
        if (entityExists)  {
            output.entityState = JSON.stringify(existingState);
            output.entityExists = entityExists;
        }

        let batch : RequestMessage[] = [];
        let operationCount = 0;
        for(let operation of operations) {
            batch[operationCount] = new RequestMessage();
            switch (operation.kind) {
                case "get":
                    //Handle inputs
                    batch[operationCount].id = JSON.stringify(operationCount);
                    batch[operationCount].name = "get";
                    batch[operationCount].signal = false;

                    //Handle outputs
                    output.results[operationCount] = new OperationResult(output.entityState, false, -1);
                    break;
                case "set":
                    //Handle inputs
                    let value = JSON.stringify(operation.value);
                    batch[operationCount].id = JSON.stringify(operationCount);
                    batch[operationCount].name = "set";
                    batch[operationCount].signal = false;
                    batch[operationCount].input = value;

                    //Handle outputs
                    output.results[operationCount] = new OperationResult(null, false, -1);
                    output.entityExists = true;
                    output.entityState = value;
                    break;
            }
            operationCount++;
        }
        return  {
            input: new DurableEntityBindingInfo(id, entityExists, JSON.stringify(existingState), batch),
            output: output
        }
    }

    public static GetCounterBatch(operations: CounterOperation[], existingState: number | undefined): EntityInputsAndOutputs {
        let id = new df.EntityId("stringstore", "stringstorekey");
        let currentState : number;
        if (existingState) {
            currentState = Number(existingState);
        };

        let entityExists : boolean = (existingState != null || existingState != undefined);;
        var output = new EntityState([],[]);
        output.entityExists = entityExists;
        let batch : RequestMessage[] = [];
        let operationCount = 0;
        for(let operation of operations) {
            batch[operationCount] = new RequestMessage();
            switch (operation.kind) {
                case "get":
                    //Handle inputs
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "get";
                    batch[operationCount].signal = false;

                    //Handle outputs
                    output.results[operationCount] = new OperationResult(JSON.stringify(currentState), false, -1);
                    break;
                case "set":
                    //Handle inputs
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "set";
                    batch[operationCount].signal = false;
                    batch[operationCount].input = operation.value.toString();

                    //Handle outputs
                    currentState = operation.value;
                    output.results[operationCount] = new OperationResult(null, false, -1);
                    output.entityExists = true;
                    output.entityState = currentState.toString();
                    break;
                case "increment":
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "increment";
                    batch[operationCount].signal = false;
                    
                    if (currentState != null) { 
                        currentState = currentState + 1;
                        output.results[operationCount] = new OperationResult(null, false, -1);
                        output.entityExists = true;
                        output.entityState = currentState.toString();
                    } else {
                        output.results[operationCount] = new OperationResult("dummy error message", true, -1);
                    }
                    break;
                case "add":
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "add";
                    batch[operationCount].signal = false;
                    batch[operationCount].input = operation.value.toString();
                    
                    if (currentState != null) {
                        currentState = currentState + operation.value;
                        output.results[operationCount] = new OperationResult(null, false, -1);
                        output.entityExists = true;
                        output.entityState = currentState.toString();
                    } else {
                        output.results[operationCount] = new OperationResult("dummy error message", true, -1);
                    }
                    break;
                case "delete":
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "add";
                    batch[operationCount].signal = false;

                    output.entityExists = false;
                    output.results[operationCount] = new OperationResult(null, false, -1);
                    break;
            }
            operationCount++;
        }
        return  {
            input: new DurableEntityBindingInfo(id, entityExists, existingState != null ? existingState.toString() : undefined, batch),
            output: output
        }
    }
}