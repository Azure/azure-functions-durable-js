import * as df from "durable-functions";
import { app, HttpHandler, HttpRequest, HttpResponse, InvocationContext } from "@azure/functions";

const httpStart: HttpHandler = async (
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponse> => {
    const client = df.getClient(context);
    const body: unknown = await request.json();

    // Get optional version from query parameter
    const version = request.query.get("version");

    let instanceId: string;
    if (version) {
        // Override the orchestration version
        instanceId = await client.startNew(request.params.orchestratorName, {
            input: body,
            version: version,
        });
        context.log(`Started orchestration with ID = '${instanceId}' and version = '${version}'.`);
    } else {
        // Use defaultVersion from host.json
        instanceId = await client.startNew(request.params.orchestratorName, {
            input: body,
        });
        context.log(`Started orchestration with ID = '${instanceId}'.`);
    }

    return client.createCheckStatusResponse(request, instanceId);
};
app.http("httpStart", {
    route: "orchestrators/{orchestratorName}",
    extraInputs: [df.input.durableClient()],
    handler: httpStart,
});
