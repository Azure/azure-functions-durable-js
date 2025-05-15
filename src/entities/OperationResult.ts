/** @hidden */
export class OperationResult {
    constructor(
        readonly isError: boolean,
        readonly duration: number,
        readonly startTime: number,
        readonly result?: string
    ) {}
}
