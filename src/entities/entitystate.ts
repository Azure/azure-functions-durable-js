import { OperationResult, Signal } from "../classes";

/** @hidden */
export class EntityState {
    public readonly entityExists: boolean;
    public entityState: string;
    public readonly results: OperationResult[];
    public readonly signals: Signal[];
}
