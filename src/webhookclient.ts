import http = require("http");
import https = require("https");
import url = require("url");
import { IHttpResponse } from "./classes";

/** @hidden */
export class WebhookClient {
    public get(requestUrl: url.URL, timeoutInMilliseconds?: number): Promise<IHttpResponse> {
        return this.callWebhook(requestUrl, "GET", undefined, timeoutInMilliseconds);
    }

    public post(requestUrl: url.URL, input?: unknown, timeoutInMilliseconds?: number): Promise<IHttpResponse> {
        return this.callWebhook(requestUrl, "POST", input, timeoutInMilliseconds);
    }

    private callWebhook(
        requestUrl: url.URL,
        httpMethod: string,
        input?: unknown,
        timeoutInMilliseconds?: number,
        ): Promise<IHttpResponse> {
        return new Promise((resolve, reject) => {
            const requestData = JSON.stringify(input);

            const options: IRequestOptions = {
                hostname: requestUrl.hostname,
                path: requestUrl.pathname + requestUrl.search,
                method: httpMethod,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": input !== undefined ? requestData.length : 0,
                },
            };

            if (requestUrl.port) {
                options.port = requestUrl.port;
            }

            if (timeoutInMilliseconds) {
                options.timeout = timeoutInMilliseconds + 500;
            }

            let requestModule: unknown;
            switch (requestUrl.protocol) {
                case "http:":
                    requestModule = http;
                    break;
                case "https:":
                    requestModule = https;
                    break;
                default:
                    throw new Error(`Unrecognized request protocol: ${requestUrl.protocol}. Only http: and https: are accepted.`); // tslint:disable-line max-line-length
            }

            const req = (requestModule as IModule).request(options, (res: http.IncomingMessage) => {
                let body = "";
                res.setEncoding("utf8");

                res.on("data", (data) => {
                    body += data;
                });

                res.on("end", () => {
                    const bodyObj = JSON.parse(body);
                    const responseObj = {
                        status: res.statusCode,
                        body: bodyObj,
                        headers: res.headers,
                    };
                    resolve(responseObj);
                });
            });

            req.on("error", (error: Error) => {
                reject(error);
            });

            if (httpMethod === "POST" && requestData) {
                req.write(requestData);
            }
            req.end();
        });
    }
}

/** @hidden */
interface IModule {
    request: IRequest;
}

/** @hidden */
interface IRequestHandler {
    on: IOn;
    write: IWrite;
    end: IEnd;
}

/** @hidden */
interface IRequestOptions {
    hostname: string;
    path: string;
    method: string;
    headers: {
        [key: string]: unknown;
    };
    port?: string;
    timeout?: number;
}

/** @hidden */
type IRequest = (options: object, callback: unknown) => IRequestHandler; // TODO: define callback as function
/** @hidden */
type IOn = (event: string, callback: unknown) => void;
/** @hidden */
type IWrite = (data: unknown) => void;
/** @hidden */
type IEnd = () => void;
