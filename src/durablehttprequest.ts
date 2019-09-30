import { TokenSource } from "./tokensource";

/**
 * Data structure representing a durable HTTP request.
 */
export class DurableHttpRequest {

    /**
     * Creates a new instance of DurableHttpRequest with the
     * specified parameters.
     *
     * @param method The HTTP request method.
     * @param uri The HTTP request URL.
     * @param content The HTTP request content.
     * @param tokenSource The type of OAuth token to add to the request.
     */
    constructor(
        /** The HTTP request method. */
        public readonly method: string,
        /** The HTTP request URL. */
        public readonly uri: string,
        /** The HTTP request content. */
        public readonly content?: string,
        /** The HTTP request headers. */
        public readonly headers?: { 
            [key: string]: string;
        },
        /** The type of OAuth token to add to the request. */
        public readonly tokenSource?: TokenSource,
    ) { }
}
