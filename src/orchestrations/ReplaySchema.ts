/**
 * @hidden
 * Supported OOProc DF extension protocols
 */
export enum ReplaySchema {
    V1 = 0,
    V2 = 1,
    V3 = 2,
    V4 = 3,
}

export const LatestReplaySchema: ReplaySchema = ReplaySchema.V4;
