import * as types from "durable-functions";

export class DurableError extends Error implements types.DurableError {
    constructor(message: string | undefined) {
        super(message);
    }
}
