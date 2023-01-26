const df = require("durable-functions");
const { app } = require("@azure/functions");

const clientInput = df.input.durableClient();

app.http("httpStart", {
    route: "orchestrators/{orchestratorName}",
    extraInputs: [clientInput],
    handler: async (request, context) => {
        const client = df.getClient(context, clientInput);
        const body = await request.text();
        const instanceId = await client.startNew(request.params.orchestratorName, undefined, body);

        context.log(`Started orchestration with ID = '${instanceId}'.`);

        return client.createCheckStatusResponse(request, instanceId);
    },
});
