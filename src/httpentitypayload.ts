/**
 * Data structure containing entity management HTTP endpoints.
 */
export class HttpEntityPayload {
    /** @hidden */
    [key: string]: string;

    /** @hidden */
    constructor(
        /** The HTTP GET entity state endpoint URL. */
        public readonly readEntityStateGetUri: string,
        /** The HTTP POST entity signal enpoint URL. */
        public readonly signalEntityPostUri: string,
    ) { }
}
