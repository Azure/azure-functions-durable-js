/** @hidden */
export class HttpCreationPayload {
    [key: string]: string | Record<string, string>;

    constructor(
        public createNewInstancePostUri: string,
        public waitOnNewInstancePostUri: string,
        public requiredHeaders: Record<string, string> = {}
    ) {}
}
