export class DurableError extends Error {
    constructor(message: string | undefined) {
        super(message);
    }
}
