export class HttpCreationPayload {
    constructor(
        public createNewInstancePostUri: string,
        public waitOnNewInstancePostUri: string,
    ) { }
}
