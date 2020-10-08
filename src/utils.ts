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
        typeInstance: T
    ): T[] {
        return collection && typeInstance
            ? (Object.keys(collection)
                  .filter((key: string) => this.hasAllPropertiesOf(collection[key], typeInstance))
                  .map((key: string) => collection[key]) as T[])
            : [];
    }

    public static getHrMilliseconds(times: number[]): number {
        return times[0] * 1000 + times[1] / 1e6;
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

    public static sleep(delayInMilliseconds: number): Promise<NodeJS.Timer> {
        return new Promise((resolve) => setTimeout(resolve, delayInMilliseconds));
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
}
