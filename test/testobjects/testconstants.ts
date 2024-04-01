export class TestConstants {
    public static readonly connectionPlaceholder: string = "CONNECTION";
    public static readonly taskHubPlaceholder: string = "TASK-HUB";
    public static readonly hostPlaceholder: string = "HOST-PLACEHOLDER";

    public static readonly testCode: string = "code=base64string";

    public static readonly entityNamePlaceholder: string = "{entityName}";
    public static readonly entityKeyPlaceholder: string = "{entityKey?}";
    public static readonly eventNamePlaceholder: string = "{eventName}";
    public static readonly functionPlaceholder: string = "{functionName}";
    public static readonly idPlaceholder: string = "[/{instanceId}]";
    public static readonly intervalPlaceholder: string = "{intervalInSeconds}";
    public static readonly operationPlaceholder: string = "{operation}";
    public static readonly reasonPlaceholder: string = "{text}";
    public static readonly timeoutPlaceholder: string = "{timeoutInSeconds}";

    public static readonly uriSuffix: string = `taskHub=${TestConstants.taskHubPlaceholder}&connection=${TestConstants.connectionPlaceholder}&${TestConstants.testCode}`; // tslint:disable-line max-line-length
    public static readonly webhookPath: string = "/runtime/webhooks/durabletask/";

    public static readonly statusQueryGetUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}?${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly sendEventPostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}/raiseEvent/${TestConstants.eventNamePlaceholder}?${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly terminatePostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}/terminate?reason=${TestConstants.reasonPlaceholder}&${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly rewindPostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}/rewind?reason=${TestConstants.reasonPlaceholder}&${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly purgeDeleteUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}?${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly suspendPostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}/suspend?reason=${TestConstants.reasonPlaceholder}&${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly resumePostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}instances/${TestConstants.idPlaceholder}/resume?reason=${TestConstants.reasonPlaceholder}&${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length

    public static readonly createPostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}orchestrators/${TestConstants.functionPlaceholder}${TestConstants.idPlaceholder}?${TestConstants.testCode}`; // tslint:disable-line max-line-length
    public static readonly waitOnPostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}orchestrators/${TestConstants.functionPlaceholder}${TestConstants.idPlaceholder}?timeout=${TestConstants.timeoutPlaceholder}&pollingInterval=${TestConstants.intervalPlaceholder}&${TestConstants.testCode}`; // tslint:disable-line max-line-length

    public static readonly entityGetUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}entities/${TestConstants.entityNamePlaceholder}/${TestConstants.entityKeyPlaceholder}&${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
    public static readonly entityPostUriTemplate: string = `${TestConstants.hostPlaceholder}${TestConstants.webhookPath}entities/${TestConstants.entityNamePlaceholder}/${TestConstants.entityKeyPlaceholder}&op=${TestConstants.operationPlaceholder}&${TestConstants.uriSuffix}`; // tslint:disable-line max-line-length
}
