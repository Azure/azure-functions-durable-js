/**
 * The response returned by [[DurableOrchestrationClient]].[[readEntityState]].
 */
export class EntityStateResponse<T> {
    constructor(
        /** Whether this entity exists or not. */
        public entityExists: boolean,

        /** The current state of the entity, if it exists, or default value otherwise. */
        public entityState: T,
    ) {}
}
