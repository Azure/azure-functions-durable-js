export class DurableFailure extends Error {
    constructor(message: string | undefined) {
        super(message);
    }
}
