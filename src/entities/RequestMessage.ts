import { EntityId } from "./EntityId";

/** @hidden */
export class RequestMessage {
    /** A unique identifier for this operation. */
    public id: string; // Id

    /**
     * The name of the operation being called (if this is an operation message)
     * or undefined (if this is a lock request).
     */
    public name?: string; // Operation

    /** Whether or not this is a one-way message. */
    public signal?: boolean; // IsSignal

    /** The operation input. */
    public input?: string; // Input

    /** The content the operation was called with. */
    public arg?: unknown; // Content

    /** The parent instance that called this operation. */
    public parent?: string; // ParentInstanceId

    /**
     * For lock requests, the set of locks being acquired. Is sorted,
     * contains at least one element, and has no repetitions.
     */
    public lockset?: EntityId[]; // LockSet

    /** For lock requests involving multiple locks, the message number. */
    public pos?: number; // Position
}
