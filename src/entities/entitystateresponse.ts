import * as types from "../types";

export class EntityStateResponse<T> implements types.EntityStateResponse<T> {
    constructor(public entityExists: boolean, public entityState?: T) {}
}
