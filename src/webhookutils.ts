/** @hidden */
export class WebhookUtils {
    public static getReadEntityUrl(
        baseUrl: string,
        requiredQueryStrings: string,
        entityName: string,
        entityKey: string,
        taskHubName?: string,
        connectionName?: string
    ): string {
        let requestUrl = baseUrl + "/entities/" + entityName + "/" + entityKey + "?";

        const queryStrings: string[] = [];
        if (taskHubName) {
            queryStrings.push("taskHub=" + taskHubName);
        }

        if (connectionName) {
            queryStrings.push("connection=" + connectionName);
        }

        queryStrings.push(requiredQueryStrings);
        requestUrl += queryStrings.join("&");
        return requestUrl;
    }

    public static getSignalEntityUrl(
        baseUrl: string,
        requiredQueryStrings: string,
        entityName: string,
        entityKey: string,
        operationName?: string,
        taskHubName?: string,
        connectionName?: string
    ): string {
        let requestUrl = baseUrl + "/entities/" + entityName + "/" + entityKey + "?";

        const queryStrings: string[] = [];
        if (operationName) {
            queryStrings.push("op=" + operationName);
        }

        if (taskHubName) {
            queryStrings.push("taskHub=" + taskHubName);
        }

        if (connectionName) {
            queryStrings.push("connection=" + connectionName);
        }

        queryStrings.push(requiredQueryStrings);
        requestUrl += queryStrings.join("&");
        return requestUrl;
    }
}
