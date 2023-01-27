import { app, HttpHandler, HttpRequest, HttpResponse, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import { DurableClient, DurableClientInput } from "durable-functions";

const timeout = "timeout";
const retryInterval = "retryInterval";

const clientInput: DurableClientInput = df.input.durableClient();

const httpSyncStart: HttpHandler = async function (
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponse> {
    const client: DurableClient = df.getClient(context, clientInput);
    const body: unknown = await request.json();
    const instanceId: string = await client.startNew(
        request.params.orchestratorName,
        undefined,
        body
    );

    context.log(`Started orchestration with ID = '${instanceId}'.`);

    const timeoutInMilliseconds: number = getTimeInMilliseconds(request, timeout) || 30000;
    const retryIntervalInMilliseconds: number =
        getTimeInMilliseconds(request, retryInterval) || 1000;

    const response: HttpResponse = await client.waitForCompletionOrCreateCheckStatusResponse(
        request,
        instanceId,
        timeoutInMilliseconds,
        retryIntervalInMilliseconds
    );
    return response;
};

app.http("httpSyncStart", {
    methods: ["POST"],
    route: "orchestrators/wait/{orchestratorName}",
    authLevel: "anonymous",
    extraInputs: [clientInput],
    handler: httpSyncStart,
});

function getTimeInMilliseconds(req: HttpRequest, queryParameterName: string): number {
    // parameters are passed in as seconds
    const queryValue: number = parseInt(req.query.get(queryParameterName));
    // return as milliseconds
    return queryValue ? queryValue * 1000 : undefined;
}
