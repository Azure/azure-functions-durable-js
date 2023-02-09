import * as types from "durable-functions";

/** @hidden */
const separator = "-----------------------------------";

export class AggregatedError extends Error implements types.AggregatedError {
    public errors: Error[];

    constructor(errors: Error[]) {
        const errorStrings = errors.map(
            (error) => `Name: ${error.name}\nMessage: ${error.message}\nStackTrace: ${error.stack}`
        );
        const message = `context.df.Task.all() encountered the below error messages:\n\n${errorStrings.join(
            `\n${separator}\n`
        )}`;
        super(message);
        this.errors = errors;
    }
}
