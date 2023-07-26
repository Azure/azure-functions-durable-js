import { DurableEntityBindingInfo } from "../../src/entities/DurableEntityBindingInfo";
import { EntityState } from "../../src/entities/EntityState";
import { OperationResult } from "../../src/entities/OperationResult";
import { RequestMessage } from "../../src/entities/RequestMessage";
import * as df from "../../src";
import {
    CounterOperation,
    EntityInputsAndOutputs,
    StringStoreOperation,
} from "../testobjects/testentityoperations";

export class TestEntityBatches {
    public static GetStringStoreBatch(
        operations: StringStoreOperation[],
        existingState: string | undefined
    ): EntityInputsAndOutputs {
        const id = new df.EntityId("stringstore", "stringstorekey");

        const entityExists = existingState !== undefined;
        const output = new EntityState([], []);
        if (entityExists) {
            output.entityState = JSON.stringify(existingState);
            output.entityExists = entityExists;
        }

        const batch: RequestMessage[] = [];
        let operationCount = 0;
        for (const operation of operations) {
            batch[operationCount] = new RequestMessage();
            switch (operation.kind) {
                case "get":
                    // Handle inputs
                    batch[operationCount].id = JSON.stringify(operationCount);
                    batch[operationCount].name = "get";
                    batch[operationCount].signal = false;

                    // Handle outputs
                    output.results[operationCount] = new OperationResult(
                        false,
                        -1,
                        output.entityState
                    );
                    break;
                case "set":
                    // Handle inputs
                    const value = JSON.stringify(operation.value);
                    batch[operationCount].id = JSON.stringify(operationCount);
                    batch[operationCount].name = "set";
                    batch[operationCount].signal = false;
                    batch[operationCount].input = value;

                    // Handle outputs
                    output.results[operationCount] = new OperationResult(false, -1);
                    output.entityExists = true;
                    output.entityState = value;
                    break;
            }
            operationCount++;
        }
        return {
            input: new DurableEntityBindingInfo(
                id,
                entityExists,
                JSON.stringify(existingState),
                batch
            ),
            output,
        };
    }

    public static GetCounterBatch(
        operations: CounterOperation[],
        existingState: number | undefined
    ): EntityInputsAndOutputs {
        const id = new df.EntityId("stringstore", "stringstorekey");
        let currentState: number | undefined;
        if (existingState) {
            currentState = Number(existingState);
        }

        const entityExists = !existingState;
        const output = new EntityState([], []);
        output.entityExists = entityExists;
        const batch: RequestMessage[] = [];
        let operationCount = 0;
        for (const operation of operations) {
            batch[operationCount] = new RequestMessage();
            switch (operation.kind) {
                case "get":
                    // Handle inputs
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "get";
                    batch[operationCount].signal = false;

                    // Handle outputs
                    output.results[operationCount] = new OperationResult(
                        false,
                        -1,
                        JSON.stringify(currentState)
                    );
                    break;
                case "set":
                    // Handle inputs
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "set";
                    batch[operationCount].signal = false;
                    batch[operationCount].input = operation.value.toString();

                    // Handle outputs
                    currentState = operation.value;
                    output.results[operationCount] = new OperationResult(false, -1);
                    output.entityExists = true;
                    output.entityState = currentState.toString();
                    break;
                case "increment":
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "increment";
                    batch[operationCount].signal = false;

                    if (currentState != null) {
                        currentState = currentState + 1;
                        output.results[operationCount] = new OperationResult(false, -1);
                        output.entityExists = true;
                        output.entityState = currentState.toString();
                    } else {
                        output.results[operationCount] = new OperationResult(
                            true,
                            -1,
                            "dummy error message"
                        );
                    }
                    break;
                case "add":
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "add";
                    batch[operationCount].signal = false;
                    batch[operationCount].input = operation.value.toString();

                    if (currentState != null) {
                        currentState = currentState + operation.value;
                        output.results[operationCount] = new OperationResult(false, -1);
                        output.entityExists = true;
                        output.entityState = currentState.toString();
                    } else {
                        output.results[operationCount] = new OperationResult(
                            true,
                            -1,
                            "dummy error message"
                        );
                    }
                    break;
                case "delete":
                    batch[operationCount].id = operationCount.toString();
                    batch[operationCount].name = "add";
                    batch[operationCount].signal = false;

                    output.entityExists = false;
                    output.results[operationCount] = new OperationResult(false, -1);
                    break;
            }
            operationCount++;
        }
        return {
            input: new DurableEntityBindingInfo(
                id,
                entityExists,
                existingState !== undefined ? existingState.toString() : undefined,
                batch
            ),
            output,
        };
    }

    public static GetAsyncStringStoreBatch(
        operations: StringStoreOperation[],
        existingState: string | undefined
    ): EntityInputsAndOutputs {
        const id = new df.EntityId("asyncstringstore", "asyncstringstorekey");

        const entityExists = existingState !== undefined;
        const output = new EntityState([], []);
        if (entityExists) {
            output.entityState = JSON.stringify(existingState);
            output.entityExists = entityExists;
        }

        const batch: RequestMessage[] = [];
        let operationCount = 0;
        for (const operation of operations) {
            batch[operationCount] = new RequestMessage();
            switch (operation.kind) {
                case "get":
                    // Handle inputs
                    batch[operationCount].id = JSON.stringify(operationCount);
                    batch[operationCount].name = "get";
                    batch[operationCount].signal = false;

                    // Handle outputs
                    output.results[operationCount] = new OperationResult(
                        false,
                        -1,
                        output.entityState
                    );
                    break;
                case "set":
                    // Handle inputs
                    const value = JSON.stringify(operation.value);
                    batch[operationCount].id = JSON.stringify(operationCount);
                    batch[operationCount].name = "set";
                    batch[operationCount].signal = false;
                    batch[operationCount].input = value;

                    // Handle outputs
                    output.results[operationCount] = new OperationResult(false, -1);
                    output.entityExists = true;
                    output.entityState = value;
                    break;
            }
            operationCount++;
        }
        return {
            input: new DurableEntityBindingInfo(
                id,
                entityExists,
                JSON.stringify(existingState),
                batch
            ),
            output,
        };
    }
}
