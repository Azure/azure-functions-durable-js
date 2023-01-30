// tslint:disable:member-access

import { OrchestrationRuntimeStatus } from "./types";

/** @hidden */
export interface GetStatusInternalOptions {
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
