import { EntityId } from "../classes";

export class Signal {
    constructor(
        public readonly target: EntityId,
        public readonly name: string,
        public readonly input: string
    ) {}
}
