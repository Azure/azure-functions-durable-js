import { OrchestrationRuntimeStatus } from "../classes";
import * as types from "durable-functions";

export class DurableOrchestrationStatus implements types.DurableOrchestrationStatus {
    public readonly name: string;
    public readonly instanceId: string;
    public readonly createdTime: Date;
    public readonly lastUpdatedTime: Date;
    public readonly input: unknown;
    public readonly output: unknown;
    public readonly runtimeStatus: OrchestrationRuntimeStatus;
    public readonly customStatus?: unknown;
    public readonly history?: Array<unknown>;

    /** @hidden */
    constructor(init: unknown) {
        if (!this.isDurableOrchestrationStatusInit(init)) {
            throw new TypeError(
                `Failed to construct a DurableOrchestrationStatus object because the initializer had invalid types or missing fields. Initializer received: ${JSON.stringify(
                    init
                )}`
            );
        }

        this.name = init.name;
        this.instanceId = init.instanceId;
        this.createdTime = new Date(init.createdTime);
        this.lastUpdatedTime = new Date(init.lastUpdatedTime);
        this.input = init.input;
        this.output = init.output;
        this.runtimeStatus = init.runtimeStatus as OrchestrationRuntimeStatus;
        this.customStatus = init.customStatus;
        this.history = init.history;
    }

    private isDurableOrchestrationStatusInit(obj: unknown): obj is DurableOrchestrationStatusInit {
        const objAsInit = obj as DurableOrchestrationStatusInit;
        return (
            objAsInit !== undefined &&
            typeof objAsInit.name === "string" &&
            typeof objAsInit.instanceId === "string" &&
            (typeof objAsInit.createdTime === "string" || objAsInit.createdTime instanceof Date) &&
            (typeof objAsInit.lastUpdatedTime === "string" ||
                objAsInit.lastUpdatedTime instanceof Date) &&
            objAsInit.input !== undefined &&
            objAsInit.output !== undefined &&
            typeof objAsInit.runtimeStatus === "string"
        );
    }
}

interface DurableOrchestrationStatusInit {
    name: string;
    instanceId: string;
    createdTime: string | Date;
    lastUpdatedTime: string | Date;
    input: unknown;
    output: unknown;
    runtimeStatus: string;
    customStatus?: unknown;
    history?: Array<unknown>;
}
