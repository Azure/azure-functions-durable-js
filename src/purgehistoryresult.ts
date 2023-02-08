import * as types from "./types";

export class PurgeHistoryResult implements types.PurgeHistoryResult {
    constructor(public readonly instancesDeleted: number) {}
}
