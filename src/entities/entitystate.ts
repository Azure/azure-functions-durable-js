import { OperationResult } from "./OperationResult";
import { Signal } from "./Signal";

/** @hidden */
export class EntityState {
    public entityExists: boolean;
    public entityState: string | undefined;
    public readonly results: OperationResult[];
    public readonly signals: Signal[];

    constructor(results: OperationResult[], signals: Signal[]) {
        this.results = results;
        this.signals = signals;
    }
}
