import { HttpCreationPayload } from "../http/HttpCreationPayload";
import { HttpManagementPayload } from "../http/HttpManagementPayload";

/** @hidden */
export class OrchestrationClientInputData {
    public static isOrchestrationClientInputData(obj: unknown): boolean {
        const typedInstance = obj as { [index: string]: unknown };
        if (typedInstance) {
            // Only check for required fields.
            if (
                typedInstance.taskHubName !== undefined &&
                typedInstance.creationUrls !== undefined &&
                typedInstance.managementUrls !== undefined
            ) {
                return true;
            }
            return false;
        }
        return false;
    }

    constructor(
        public taskHubName: string,
        public creationUrls: HttpCreationPayload,
        public managementUrls: HttpManagementPayload,
        public baseUrl?: string,
        public requiredQueryStringParameters?: string,
        public rpcBaseUrl?: string
    ) {}
}
