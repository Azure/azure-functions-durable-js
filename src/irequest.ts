/** @hidden */
export interface IRequest {
    method: string;
    url: string;
    headers?: {
        [key: string]: string;
    };
    query?: {
        [key: string]: string;
    };
    params?: {
        [key: string]: string;
    };
    body?: unknown;
    rawbody?: unknown;
}
