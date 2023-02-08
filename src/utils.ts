import { Duration } from "luxon";

/** @hidden */
export class Utils {
    public static processInput<T>(input: string | T): string | T {
        // If we fail to stringify inputs, they may get deserialized incorrectly.
        // For instance: "13131" might get interpreted as a number.
        // Somehow this doesn't appear to occur with other datatypes, but we should
        // investigate that further.
        if (typeof input === "string") {
            input = JSON.stringify(input);
        }
        return input;
    }
    public static getInstancesOf<T>(
        collection: { [index: string]: unknown },
        abstractClass: T // this should be an abstract class that contains only the _required_ properties
    ): T[] {
        if (collection && abstractClass) {
            const candidateObjects = Object.values(collection).filter((value) =>
                this.hasAllPropertiesOf(value, abstractClass)
            );

            this.parseTimestampsAsDates(candidateObjects);

            return candidateObjects as T[];
        }
        return [];
    }

    public static getHrMilliseconds(times: number[]): number {
        return times[0] * 1000 + times[1] / 1e6;
    }

    public static hasStringProperty<X extends {}, Y extends PropertyKey>(
        obj: X,
        prop: Y
    ): obj is X & Record<Y, string> {
        if (Utils.hasOwnProperty(obj, prop)) {
            const propKey = prop as keyof typeof obj;
            const property = obj[propKey];
            const propertyIsString = typeof property === "string";
            return propertyIsString;
        }
        return false;
    }

    public static hasOwnProperty<X extends {}, Y extends PropertyKey>(
        obj: X,
        prop: Y
    ): obj is X & Record<Y, unknown> {
        // informs TS that an object has a property
        return obj.hasOwnProperty(prop);
    }

    public static parseTimestampsAsDates(obj: unknown): void {
        if (typeof obj === "object" && obj != null) {
            if (this.hasOwnProperty(obj, "Timestamp") && typeof obj.Timestamp === "string") {
                obj.Timestamp = new Date(obj.Timestamp);
            }
            Object.values(obj).map((value) => {
                // This recursive step ensures _all_ Timestamp properties are converted properly
                // For example, a payload can contain the history as a property, so if we want to
                // parse each HistoryEvent's Timestamp, we need to traverse the payload recursively
                this.parseTimestampsAsDates(value);
            });
        }
    }

    public static hasAllPropertiesOf<T>(obj: unknown, refInstance: T): boolean {
        return (
            typeof refInstance === "object" &&
            typeof obj === "object" &&
            obj !== null &&
            Object.keys(refInstance).every((key: string) => {
                return obj.hasOwnProperty(key);
            })
        );
    }

    public static ensureNonNull<T>(argument: T | undefined, message: string): T {
        if (argument === undefined) {
            throw new TypeError(message);
        }

        return argument;
    }

    public static async sleep(delayInMilliseconds: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, delayInMilliseconds));
    }

    public static throwIfNotInstanceOf<T>(
        value: unknown,
        name: string,
        refInstance: T,
        type: string
    ): void {
        if (!this.hasAllPropertiesOf<T>(value, refInstance)) {
            throw new TypeError(
                `${name}: Expected object of type ${type} but got ${typeof value}; are you missing properties?`
            );
        }
    }

    public static throwIfEmpty(value: unknown, name: string): void {
        if (typeof value !== "string") {
            throw new TypeError(
                `${name}: Expected non-empty, non-whitespace string but got ${typeof value}`
            );
        } else if (value.trim().length < 1) {
            throw new Error(
                `${name}: Expected non-empty, non-whitespace string but got empty string`
            );
        }
    }

    public static throwIfNotNumber(value: unknown, name: string): void {
        if (typeof value !== "number") {
            throw new TypeError(`${name}: Expected number but got ${typeof value}`);
        }
    }

    /**
     * @hidden
     * Converts a string in the format `[-][d.]hh:mm:ss[.fffffff]`
     * to a `Duration` object
     * (This is the format the default .NET serializer uses, and the
     * format coming from the Durable extension)
     * @param input the formatted string
     */
    public static durationFromString(input: string): Duration {
        if (input[0] === "-") {
            // We should not be getting negative durations
            throw new Error("Received negative duration. Negative durations are not supported.");
        }

        const parts = input.split(".");
        // the middle part that's always there
        let isoTimeString: string;
        // optional number of days
        let days = 0;
        // optional number of milliseconds
        let millis = 0;

        if (parts[0].includes(":")) {
            // no days, straight to hours
            isoTimeString = parts[0];
            // add millis if they exist
            if (parts.length > 1) {
                const fractionalStr = `0.${parts[1]}`;
                millis = parseFloat(fractionalStr) * 1000;
            }
        } else {
            // we have days
            days = parseInt(parts[0]);
            // second part is iso time string
            isoTimeString = parts[1];
            // add millis if they exist
            if (parts.length > 2) {
                const fractionalStr = `0.${parts[2]}`;
                millis = parseFloat(fractionalStr) * 1000;
            }
        }

        return Duration.fromISOTime(isoTimeString).plus({ days, milliseconds: millis });
    }
}
