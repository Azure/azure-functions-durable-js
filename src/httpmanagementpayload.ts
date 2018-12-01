/**
 * Data structure containing instance management HTTP endpoints.
 */
export class HttpManagementPayload {
    /** @hidden */
    constructor(
        /** The ID of the orchestration instance. */
        public readonly id: string,
        /** The HTTP GET status query endpoint URL. */
        public readonly statusQueryGetUri: string,
        /** The HTTP POST external event sending endpoint URL. */
        public readonly sendEventPostUri: string,
        /** The HTTP POST instance termination endpoint. */
        public readonly terminatePostUri: string,
        /** The HTTP POST instance rewind endpoint. */
        public readonly rewindPostUri: string,
    ) { }
}
