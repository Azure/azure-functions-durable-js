/** @hidden */
export class HttpCreationPayload {
    [key: string]: string;

    constructor(public createNewInstancePostUri: string, public waitOnNewInstancePostUri: string) {}
}
