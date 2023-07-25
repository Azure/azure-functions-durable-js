import { EntityId } from "./entityid";
import { RequestMessage } from "./requestmessage";

/** @hidden */
export class DurableEntityBindingInfoReqFields {
    constructor(
        public readonly self: EntityId,
        public readonly exists: boolean,
        public readonly batch: RequestMessage[]
    ) {}
}

/** @hidden */
export class DurableEntityBindingInfo extends DurableEntityBindingInfoReqFields {
    constructor(
        public readonly self: EntityId,
        public readonly exists: boolean,
        public readonly state: string | undefined,
        public readonly batch: RequestMessage[]
    ) {
        super(self, exists, batch);
    }
}
