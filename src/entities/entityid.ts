// tslint:disable:member-access

import { Utils } from "../util/Utils";
import * as types from "durable-functions";

export class EntityId implements types.EntityId {
    /** @hidden */
    static getEntityIdFromSchedulerId(schedulerId: string): EntityId {
        const pos = schedulerId.indexOf("@", 1);
        const entityName = schedulerId.substring(1, pos);
        const entityKey = schedulerId.substring(pos + 1);
        return new EntityId(entityName, entityKey);
    }

    /** @hidden */
    static getSchedulerIdFromEntityId(entityId: EntityId): string {
        return `@${entityId.name.toLowerCase()}@${entityId.key}`;
    }

    constructor(
        // TODO: consider how to name these fields more accurately without interfering with JSON serialization
        public readonly name: string,
        public readonly key: string
    ) {
        Utils.throwIfEmpty(name, "name");
        Utils.throwIfEmpty(key, "key");
    }

    public toString(): string {
        return EntityId.getSchedulerIdFromEntityId(this);
    }
}
