import { HttpCreationPayload, HttpManagementPayload } from "./classes";

/** @hidden */
export class OrchestrationClientInputData {
    constructor(
        public taskHubName: string,
        public creationUrls: HttpCreationPayload,
        public managementUrls: HttpManagementPayload,
        public baseUrl: string,
        public requiredQueryStringParameters: string,
    ) { }
}
