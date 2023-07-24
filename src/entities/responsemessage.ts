import { Utils } from "../util/Utils";

/** @hidden */
export class ResponseMessage {
    public result?: string; // Result
    public exceptionType?: string; // ExceptionType

    public constructor(event: unknown) {
        if (typeof event === "object" && event !== null) {
            if (Utils.hasStringProperty(event, "result")) {
                this.result = event.result;
            }
            if (Utils.hasStringProperty(event, "exceptionType")) {
                this.exceptionType = event.exceptionType;
            }
        } else {
            throw Error(
                "Attempted to construct ResponseMessage event from incompatible History event. " +
                    "This is probably a bug in History-replay. Please file a bug report."
            );
        }
    }
}

// TODO: error deserialization
