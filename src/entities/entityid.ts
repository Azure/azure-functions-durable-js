// tslint:disable:member-access

import { Utils } from "../utils";

/**
 * A unique identifier for an entity, consisting of entity class and entity key.
 */
export class EntityId {
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

    /**
     * Create an entity id for an entity.
     */
    constructor(
        // TODO: consider how to name these fields more accurately without interfering with JSON serialization
        /** The name of the entity class. */
        public readonly name: string,
        /** The entity key. Uniquely identifies an entity among all instances of the same class. */
        public readonly key: string
    ) {
        Utils.throwIfEmpty(name, "name");
        Utils.throwIfEmpty(key, "key");
    }

    public toString(): string {
        return EntityId.getSchedulerIdFromEntityId(this);
    }
}
