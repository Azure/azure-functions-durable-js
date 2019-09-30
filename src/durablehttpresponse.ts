/**
 * Data structure representing a durable HTTP response.
 */
export interface DurableHttpResponse {
    /** The HTTP response status code. */
    statusCode: number;

    /** The HTTP response content. */
    content?: string;

    /** The HTTP response headers. */
    headers?: {
        [key: string]: string;
    };
}