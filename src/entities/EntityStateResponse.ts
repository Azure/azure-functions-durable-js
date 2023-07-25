import * as types from "durable-functions";

export class EntityStateResponse<T> implements types.EntityStateResponse<T> {
    constructor(public entityExists: boolean, public entityState?: T) {}
}
