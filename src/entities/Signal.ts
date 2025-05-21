import { EntityId } from "./EntityId";

/** @hidden */
export class Signal {
    constructor(
        public readonly target: EntityId,
        public readonly name: string,
        public readonly input: string,
        public readonly requestId: string,
        public readonly requestTime: number
    ) {}
}
