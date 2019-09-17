import { OperationResult, Signal } from "../classes";

/** @hidden */
export class EntityState {
    public entityExists: boolean;
    public entityState: string;
    public readonly results: OperationResult[];
    public readonly signals: Signal[];

    constructor(results: OperationResult[], signals: Signal[]) {
        this.results = results;
        this.signals = signals;
    }
}
