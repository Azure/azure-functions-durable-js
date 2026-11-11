import * as types from "durable-functions";

export class HttpManagementPayload implements types.HttpManagementPayload {
    /** @hidden */
    [key: string]: string | Record<string, string>;

    /** @hidden */
    constructor(
        public readonly id: string,
        public readonly statusQueryGetUri: string,
        public readonly sendEventPostUri: string,
        public readonly terminatePostUri: string,
        public readonly rewindPostUri: string,
        public readonly purgeHistoryDeleteUri: string,
        public readonly suspendPostUri: string,
        public readonly resumePostUri: string,
        public readonly restartPostUri: string = "",
        public readonly requiredHeaders: Record<string, string> = {}
    ) {}
}
