import * as types from "./types";

/**
 * Class to hold statistics about this execution of purge history.
 */
export class PurgeHistoryResult implements types.PurgeHistoryResult {
    constructor(
        /**
         * The number of deleted instances.
         */
        public readonly instancesDeleted: number
    ) {}
}
