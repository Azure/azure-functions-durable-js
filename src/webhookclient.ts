import http = require("http");
import https = require("https");
import { HttpResponse } from "./classes";

export class WebhookClient {
    public get(url: URL, timeoutInMilliseconds?: number): Promise<HttpResponse> {
        return this.callWebhook(url, "GET", undefined, timeoutInMilliseconds);
    }

    public post(url: URL, input?: unknown, timeoutInMilliseconds?: number): Promise<HttpResponse> {
        return this.callWebhook(url, "POST", input, timeoutInMilliseconds);
    }

    private callWebhook(
        url: URL,
        httpMethod: string,
        input?: unknown,
        timeoutInMilliseconds?: number,
        ): Promise<HttpResponse> {
        return new Promise((resolve, reject) => {
            const requestData = JSON.stringify(input);

            const options: IRequestOptions = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: httpMethod,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": input !== undefined ? requestData.length : 0,
                },
            };

            if (url.port) {
                options.port = url.port;
            }

            if (timeoutInMilliseconds) {
                options.timeout = timeoutInMilliseconds + 500;
            }

            let requestModule: unknown;
            switch (url.protocol) {
                case "http:":
                    requestModule = http;
                    break;
                case "https:":
                    requestModule = https;
                    break;
                default:
                    throw new Error(`Unrecognized request protocol: ${url.protocol}. Only http: and https: are accepted.`); // tslint:disable-line max-line-length
            }

            const req = (requestModule as IModule).request(options, (res: http.IncomingMessage) => {
                let body = "";
                res.setEncoding("utf8");

                res.on("data", (data) => {
                    body += data;
                });

                res.on("end", () => {
                    const bodyObj = JSON.parse(body);
                    const responseObj = new HttpResponse(res.statusCode, bodyObj, res.headers);
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

interface IModule {
    request: IRequest;
}

interface IRequestHandler {
    on: IOn;
    write: IWrite;
    end: IEnd;
}

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

type IRequest = (options: object, callback: unknown) => IRequestHandler; // TODO: define callback as function
type IOn = (event: string, callback: unknown) => void;
type IWrite = (data: unknown) => void;
type IEnd = () => void;
