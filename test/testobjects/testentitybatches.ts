import * as df from "../../src";
import { EntityState, DurableEntityBindingInfo, RequestMessage, OperationResult, GuidManager } from "../../src/classes";

export class TestEntityBatches {

    public static GetStringStoreBatch(operations: StringStoreOperation[], existingState: string): EntityInputsAndOutputs {
        let id = new df.EntityId("stringstore", "stringstorekey");
        let currentState : string = existingState;
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
                    batch[operationCount].id = JSON.stringify(operationCount);
                    batch[operationCount].op = "get";
                    batch[operationCount].signal = false;

                    //Handle outputs
                    output.results[operationCount] = new OperationResult(JSON.stringify(currentState), false, -1);
                    break;
                case "set":
                    //Handle inputs
                    let value = operation.value;
                    batch[operationCount].id = JSON.stringify(operationCount);
                    batch[operationCount].op = "set";
                    batch[operationCount].signal = false;
                    batch[operationCount].input = JSON.stringify(value);

                    //Handle outputs
                    currentState = value;
                    output.results[operationCount] = new OperationResult(null, false, -1);
                    output.entityExists = true;
                    output.entityState = JSON.stringify(value);
                    break;
            }
            operationCount++;
        }
        return  {
            input: new DurableEntityBindingInfo(id, entityExists, existingState, batch),
            output: output
        }
    }
}

export interface EntityInputsAndOutputs {
    input: DurableEntityBindingInfo;
    output: EntityState;
}

export interface StringStoreGet {
    kind : "get";
}

export interface StringStoreSet {
    kind : "set";
    value : string;
}

export type StringStoreOperation = StringStoreGet | StringStoreSet;