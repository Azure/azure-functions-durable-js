import { EntityId } from "./entityid";

/** @hidden */
export class Signal {
    constructor(
        public readonly target: EntityId,
        public readonly name: string,
        public readonly input: string
    ) {}
}
