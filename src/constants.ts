/** @hidden */
export class Constants {
    public static readonly BadWebhookStatusMessage: string = "Webhook returned unrecognized status code {0}";
    public static readonly CancelCompletedTaskMessage: string = "Cannot cancel a completed task.";
    public static readonly InstanceNotFoundMessage: string = "No instance with ID '{0}' found.";
    public static readonly InvalidFirstRetryIntervalValueMessage: string = "firstRetryIntervalInMilliseconds value must be greater than 0."; // tslint:disable-line max-line-length
    public static readonly InvalidRequestContentFormatMessage: string = "Only application/json request content is supported"; // tslint:disable-line max-line-length
    public static readonly InvalidStringMessage: string = "{0} must be a valid string.";
    public static readonly NotDateMessage: string = "{0}: Expected valid Date object but got {1}";
    public static readonly NotStringMessage: string = "{0}: Expected non-empty, non-whitespace string but got {1}";
    public static readonly NotInstanceOfTypeMessage: string = "{0}: Expected object of type {1} but got {2}; are you missing properties?"; // tslint:disable-line max-line-length
    public static readonly OrchestrationClientNoBindingFoundMessage: string = "An orchestration client function must have an orchestrationClient input binding. Check your function.json definition."; // tslint:disable-line max-line-length
    public static readonly OrchestrationContextNoBindingFoundMessage: string = "Could not finding an orchestrationClient binding on context."; // tslint:disable-line max-line-length
    public static readonly PlaceholderMessage: string = "This is a placeholder.";
    public static readonly RewindNonFailedInstanceMessage: string = "The rewind operation is only supported on failed orchestration instances."; // tslint:disable-line max-line-length
    public static readonly TimeoutLessThanRetryTimeoutMessage: string = "Total timeout {0} (ms) should be bigger than retry timeout {1} (ms)"; // tslint:disable-line max-line-length

    public static readonly DefaultLocalHost: string = "localhost:7071";
    public static readonly DefaultLocalOrigin: string = `http://${Constants.DefaultLocalHost}`;
}
