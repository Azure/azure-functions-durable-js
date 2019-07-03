import { HttpCreationPayload, HttpEntityPayload, HttpManagementPayload } from "./classes";

/** @hidden */
export class OrchestrationClientInputData {
    constructor(
        public taskHubName: string,
        public creationUrls: HttpCreationPayload,
        public managementUrls: HttpManagementPayload,
        public entityUrls: HttpEntityPayload,
    ) { }
}
