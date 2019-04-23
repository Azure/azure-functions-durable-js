// tslint:disable:member-access

import { Utils } from "../utils";

/**
 * A unique identifier for an actor, consisting of actor class and actor key.
 */
export class ActorId {
    /** @hidden */
    static getActorIdFromSchedulerId(schedulerId: string): ActorId {
        const pos = schedulerId.indexOf("@", 1);
        const actorClass = schedulerId.substring(1, pos);
        const actorKey = schedulerId.substring(pos + 1);
        return new ActorId(actorClass, actorKey);
    }

    /** @hidden */
    static getSchedulerIdFromActorId(actorId: ActorId): string {
        return `@${actorId.actorClass}@${actorId.actorKey}`;
    }

    /**
     * Create an actor id for an actor.
     */
    constructor(
        // TODO: consider how JSON deserialization affects these fields
        /** The name of the actor class. */
        public readonly actorClass: string,
        /** The actor key. Uniquely identifies an actor among all instances of the same class. */
        public readonly actorKey: string,
    ) {
        Utils.throwIfEmpty(actorClass, "actorClass");
        Utils.throwIfEmpty(actorKey, "actorKey");
    }

    public toString(): string {
        return ActorId.getSchedulerIdFromActorId(this);
    }

    // TODO: equals

    // TODO: comparer
}
