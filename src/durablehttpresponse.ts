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

    // returns the specified header, case insensitively
    // returns undefined if the header is not set
    public getHeader(name: string): string | undefined {
        if (this.headers) {
            const foundKey = Object.keys(this.headers).find(
                (key) => key.toLowerCase() === name.toLowerCase()
            );
            if (foundKey) {
                return this.headers[foundKey];
            }
        }
        return undefined;
    }
}
