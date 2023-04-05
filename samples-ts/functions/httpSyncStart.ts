import {
    app,
    HttpHandler,
    HttpRequest,
    HttpResponse,
    HttpResponseInit,
    InvocationContext,
} from "@azure/functions";
import * as df from "durable-functions";

const timeout = "timeout";
const retryInterval = "retryInterval";

const httpSyncStart: HttpHandler = async function (
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponse> {
    const client = df.getClient(context);
    const body: unknown = await request.json();
    const instanceId: string = await client.startNew(request.params.orchestratorName, {
        input: body,
    });

    context.log(`Started orchestration with ID = '${instanceId}'.`);

    const timeoutInMilliseconds: number = getTimeInMilliseconds(request, timeout) || 30000;
    const retryIntervalInMilliseconds: number =
        getTimeInMilliseconds(request, retryInterval) || 1000;

    const response = await client.waitForCompletionOrCreateCheckStatusResponse(
        request,
        instanceId,
        {
            timeoutInMilliseconds,
            retryIntervalInMilliseconds,
        }
    );
    return response;
};

app.http("httpSyncStart", {
    methods: ["POST"],
    route: "orchestrators/wait/{orchestratorName}",
    authLevel: "anonymous",
    extraInputs: [df.input.durableClient()],
    handler: httpSyncStart,
});

function getTimeInMilliseconds(req: HttpRequest, queryParameterName: string): number {
    // parameters are passed in as seconds
    const queryValue: number = parseInt(req.query.get(queryParameterName));
    // return as milliseconds
    return queryValue ? queryValue * 1000 : undefined;
}
