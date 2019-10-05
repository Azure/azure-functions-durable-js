import { HttpCreationPayload, HttpEntityPayload, HttpManagementPayload,
    OrchestrationClientInputData } from "../../src/classes";
import { TestConstants } from "./testconstants";

export class TestUtils {
    public static createOrchestrationClientInputData(
        id: string,
        host: string,
        taskHub: string = TestConstants.taskHubPlaceholder,
        connection: string = TestConstants.connectionPlaceholder) {
        return new OrchestrationClientInputData(
            taskHub,
            TestUtils.createHttpCreationPayload(host, taskHub, connection),
            TestUtils.createHttpManagementPayload(id, host, taskHub, connection),
            TestUtils.createEntityManagementUrl(host, taskHub, connection),
        );
    }

    public static createHttpCreationPayload(host: string, taskHub: string, connection: string) {
        return new HttpCreationPayload(
            TestConstants.createPostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            TestConstants.waitOnPostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
        );
    }

    public static createHttpManagementPayload(id: string, host: string, taskHub: string, connection: string) {
        return new HttpManagementPayload(
            id,
            TestConstants.statusQueryGetUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            TestConstants.sendEventPostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            TestConstants.terminatePostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            TestConstants.rewindPostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            TestConstants.purgeDeleteUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
        );
    }

    public static createEntityManagementUrl(host: string, taskHub: string, connection: string) {
        return new HttpEntityPayload(
            TestConstants.entityGetUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            TestConstants.entityPostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
        );
    }
}
