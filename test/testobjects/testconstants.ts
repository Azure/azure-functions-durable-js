export class TestConstants {
    public static readonly connectionPlaceholder: string = "CONNECTION";
    public static readonly taskHubPlaceholder: string = "TASK-HUB";
    public static readonly hostPlaceholder: string = "HOST-PLACEHOLDER";

    public static readonly testCode: string = "code=base64string";

    public static readonly eventNamePlaceholder = "{eventName}";
    public static readonly functionPlaceholder: string = "{functionName}";
    public static readonly idPlaceholder: string = "[/{instanceId}]";
    public static readonly intervalPlaceholder = "{intervalInSeconds}";
    public static readonly reasonPlaceholder = "{text}";
    public static readonly timeoutPlaceholder: string = "{timeoutInSeconds}";

    public static readonly uriSuffix = `taskHub=${TestConstants.taskHubPlaceholder}&connection=${TestConstants.connectionPlaceholder}&${TestConstants.testCode}`; // tslint:disable-line max-line-length
    public static readonly webhookPath: string = "/runtime/webhooks/durabletask/";

    public static readonly statusQueryGetUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}?${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly sendEventPostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}/raiseEvent/{eventName}?${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly terminatePostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}/terminate?reason=${TestConstants.reasonPlaceholder}&${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly rewindPostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}/rewind?reason=${TestConstants.reasonPlaceholder}&${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length

    public static readonly createPostUriTemplate = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}orchestrators/${TestConstants.functionPlaceholder}${TestConstants.idPlaceholder}?${TestConstants.testCode}`; // tslint:disable-line max-line-length
    public static readonly waitOnPostUriTemplate = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}orchestrators/${TestConstants.functionPlaceholder}${TestConstants.idPlaceholder}?timeout=${TestConstants.timeoutPlaceholder}&pollingInterval=${TestConstants.intervalPlaceholder}&${TestConstants.testCode}`; // tslint:disable-line max-line-length
}
