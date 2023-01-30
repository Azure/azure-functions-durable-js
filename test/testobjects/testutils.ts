import {
    HttpCreationPayload,
    IOrchestratorState,
    OrchestrationClientInputData,
} from "../../src/classes";
import { OrchestrationFailureError } from "../../src/orchestrationfailureerror";
import { HttpManagementPayload } from "../../src/types";
import { TestConstants } from "./testconstants";

export class TestUtils {
    public static createOrchestrationClientInputData(
        id: string,
        host: string,
        taskHub: string = TestConstants.taskHubPlaceholder,
        connection: string = TestConstants.connectionPlaceholder
    ): OrchestrationClientInputData {
        return new OrchestrationClientInputData(
            taskHub,
            TestUtils.createHttpCreationPayload(host, taskHub, connection),
            TestUtils.createHttpManagementPayload(id, host, taskHub, connection),
            // Returns baseURL with remaining whitespace trimmed.
            `${host}${TestConstants.webhookPath.replace(/\/$/, "")}`,
            TestConstants.testCode
        );
    }

    public static createV1OrchestrationClientInputData(
        id: string,
        host: string,
        taskHub: string = TestConstants.taskHubPlaceholder,
        connection: string = TestConstants.connectionPlaceholder
    ): OrchestrationClientInputData {
        return new OrchestrationClientInputData(
            taskHub,
            TestUtils.createHttpCreationPayload(host, taskHub, connection),
            TestUtils.createHttpManagementPayload(id, host, taskHub, connection)
        );
    }

    public static createHttpCreationPayload(
        host: string,
        taskHub: string,
        connection: string
    ): HttpCreationPayload {
        return new HttpCreationPayload(
            TestConstants.createPostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            TestConstants.waitOnPostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection)
        );
    }

    public static createHttpManagementPayload(
        id: string,
        host: string,
        taskHub: string,
        connection: string
    ): HttpManagementPayload {
        return {
            id,
            statusQueryGetUri: TestConstants.statusQueryGetUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            sendEventPostUri: TestConstants.sendEventPostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            terminatePostUri: TestConstants.terminatePostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            rewindPostUri: TestConstants.rewindPostUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
            purgeHistoryDeleteUri: TestConstants.purgeDeleteUriTemplate
                .replace(TestConstants.hostPlaceholder, host)
                .replace(TestConstants.idPlaceholder, id)
                .replace(TestConstants.taskHubPlaceholder, taskHub)
                .replace(TestConstants.connectionPlaceholder, connection),
        };
    }

    public static extractStateFromError(err: OrchestrationFailureError): IOrchestratorState {
        const label = "\n\n$OutOfProcData$:";
        const message = err.message;
        const dataStart = message.indexOf(label) + label.length;
        const dataJson = message.substr(dataStart);
        return JSON.parse(dataJson) as IOrchestratorState;
    }
}
