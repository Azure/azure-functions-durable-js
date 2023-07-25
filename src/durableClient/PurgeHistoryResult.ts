import * as types from "durable-functions";

export class PurgeHistoryResult implements types.PurgeHistoryResult {
    constructor(public readonly instancesDeleted: number) {}
}
