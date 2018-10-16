import { HttpCreationPayload, HttpManagementPayload } from "./classes";

export class OrchestrationClientInputData {
    constructor(
        public taskHubName: string,
        public creationUrls: HttpCreationPayload,
        public managementUrls: HttpManagementPayload,
    ) { }
}
