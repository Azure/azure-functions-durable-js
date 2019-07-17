/** @hidden */
export class OperationResult {
    constructor(
        readonly result: string,
        readonly isError: boolean,
        readonly duration: number,
    ) { }
}
