/** @hidden */
export class WebhookUtils {
    public static encodePathSegment(value: unknown, parameterName: string): string {
        if (typeof value !== "string" || value.length === 0) {
            throw new Error(`${parameterName} must be a valid string.`);
        }

        // URL parsers normalize dot-only segments even when the dots are percent-encoded.
        if (
            value === "." ||
            value === ".." ||
            /[/\\?#]/.test(value) ||
            Array.from(value).some((character) => {
                const code = character.charCodeAt(0);
                return code < 32 || (code >= 127 && code <= 159);
            })
        ) {
            throw new Error(
                `${parameterName} must not be '.' or '..', or contain '/', '\\', '?', '#', or control characters.`
            );
        }

        // The HTTP host, Durable HTTP handler, and route matcher each decode path segments.
        return encodeURIComponent(encodeURIComponent(encodeURIComponent(value)));
    }

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
