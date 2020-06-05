/**
 * @hidden
 * Represents the options that can be provided for the "reason" field of events in
 * Durable Functions 2.0.
 */
export enum ExternalEventType {
    ExternalEvent = "ExternalEvent",
    LockAcquisitionCompleted = "LockAcquisitionCompleted",
    EntityResponse = "EntityResponse",
}
