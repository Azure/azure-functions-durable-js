/** @hidden */
export class HttpCreationPayload {
    [key: string]: string;

    constructor(public createNewInstancePostUrl: string, public waitOnNewInstancePostUrl: string) {}
}
