import * as types from "durable-functions";

export abstract class EntityClass<T = unknown> implements types.EntityClass<T> {
    state: T;

    [key: string]: T | ((input?: unknown) => T | void);
}
