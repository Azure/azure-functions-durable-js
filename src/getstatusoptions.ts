// tslint:disable:member-access

import { OrchestrationRuntimeStatus } from "./classes";

/** @hidden */
export class GetStatusOptions {
    instanceId?: string;
    taskHubName?: string;
    connectionName?: string;
    showHistory?: boolean;
    showHistoryOutput?: boolean;
    createdTimeFrom?: Date;
    createdTimeTo?: Date;
    runtimeStatus?: OrchestrationRuntimeStatus[];
    showInput?: boolean;
}
