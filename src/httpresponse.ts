/** @hidden */
export class HttpResponse {
    constructor(
        public status: number,
        public body: unknown,
        public headers?: object,
    ) { }
}
