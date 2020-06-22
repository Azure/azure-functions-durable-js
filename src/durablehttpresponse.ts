/**
 * Data structure representing a durable HTTP response.
 */
export class DurableHttpResponse {
    /**
     * Creates a new instance of DurableHttpResponse with the
     * specified parameters.
     *
     * @param statusCode The HTTP response status code.
     * @param content The HTTP response content.
     * @param headers The HTTP response headers.
     */
    constructor(
        /** The HTTP response status code. */
        public statusCode: number,

        /** The HTTP response content. */
        public content?: string,

        /** The HTTP response headers. */
        public headers?: {
            [key: string]: string;
        }
    ) {}
}
