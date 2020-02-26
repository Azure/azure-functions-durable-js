const separator = "-----------------------------------";

/**
 * A specfic error thrown when context.df.Task.all() fails. Its message
 * contains an aggregation of all the exceptions that failed. It should follow the
 * below format:
 *
 * context.df.Task.all() encountered the below error messages:
 *
 * Name: DurableError
 * Message: The activity function "ActivityA" failed.
 * StackTrace: <stacktrace>
 * -----------------------------------
 * Name: DurableError
 * Message: The activity function "ActivityB" failed.
 * StackTrace: <stacktrace>
 */
export class AggregatedError extends Error {
    public errors: Error[];

    constructor(errors: Error[]) {
        const errorStrings = errors.map(error => `Name: ${error.name}\nMessage: ${error.message}\nStackTrace: ${error.stack}`);
        const message = `context.df.Task.all() encountered the below error messages:\n\n${errorStrings.join(`\n${separator}\n`)}`;
        super(message);
        this.errors = errors;
    }
}
