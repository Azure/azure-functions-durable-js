/**
 * Adapted from IRequest in [Azure Functions' node.js worker.](https://github.com/Azure/azure-functions-nodejs-worker)
 */
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
