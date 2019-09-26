import { DurableEntityBindingInfo, EntityState } from "../../src/classes";

export type EntityInputsAndOutputs = {
    input: DurableEntityBindingInfo;
    output: EntityState;
};

export type Get  = {
    kind: "get";
};

export type Set<T> = {
    kind: "set";
    value: T;
};

export type Increment = {
    kind: "increment";
};

export type Add<T> = {
    kind: "add";
    value: T;
};

export type Delete = {
    kind: "delete";
};

export type StringStoreOperation = Get | Set<string>;

export type CounterOperation = Get | Set<number> | Increment | Add<number> | Delete;
