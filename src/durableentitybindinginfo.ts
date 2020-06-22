import { EntityId, RequestMessage } from "./classes";

/** @hidden */
export class DurableEntityBindingInfo {
    constructor(
        public readonly self: EntityId,
        public readonly exists: boolean,
        public readonly state: string | undefined,
        public readonly batch: RequestMessage[]
    ) {}
}
