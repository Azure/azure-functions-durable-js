import * as df from "durable-functions";
import { app, HttpHandler, HttpRequest, HttpResponse, InvocationContext } from "@azure/functions";
import { DurableClientInput, DurableClient } from "durable-functions";

const clientInput: DurableClientInput = df.input.durableClient();

const httpStart: HttpHandler = async (
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponse> => {
    const client: DurableClient = df.getClient(context, clientInput);
    const body: unknown = await request.json();
    const instanceId: string = await client.startNew(
        request.params.orchestratorName,
        undefined,
        body
    );

    context.log(`Started orchestration with ID = '${instanceId}'.`);

    return client.createCheckStatusResponse(request, instanceId);
};
app.http("httpStart", {
    route: "orchestrators/{orchestratorName}",
    extraInputs: [clientInput],
    handler: httpStart,
});
