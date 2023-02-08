import * as types from "./types";

export class DurableError extends Error implements types.DurableError {
    constructor(message: string | undefined) {
        super(message);
    }
}
