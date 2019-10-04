import { DurableEntityBindingInfo, EntityState } from "../../src/classes";

export interface EntityInputsAndOutputs {
    input: DurableEntityBindingInfo;
    output: EntityState;
}

export interface Get {
    kind: "get";
}

export interface Set<T> {
    kind: "set";
    value: T;
}

export interface Increment {
    kind: "increment";
}

export interface Add<T> {
    kind: "add";
    value: T;
}

export interface Delete {
    kind: "delete";
}

export type StringStoreOperation = Get | Set<string>;

export type CounterOperation = Get | Set<number> | Increment | Add<number> | Delete;
