export class HttpResponse {
    constructor(
        public status: number,
        public body: any,
        public headers?: object,
    ) { }
}
