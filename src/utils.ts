import { Constants } from "./classes";

/** @hidden */
export class Utils {
    public static getInstancesOf<T>(collection: { [index: string]: unknown }, typeInstance: T): T[] {
        return collection && typeInstance
            ? Object.keys(collection)
                .filter((key: string) => this.hasAllPropertiesOf(collection[key], typeInstance))
                .map((key: string) => collection[key]) as T[]
            : [];
    }

    public static getHrMilliseconds(times: number[]): number {
        return times[0] * 1000 + times[1] / 1e6;
    }

    public static hasAllPropertiesOf<T>(obj: unknown, refInstance: T): boolean {
        return typeof refInstance === "object"
            && typeof obj === "object"
            && obj !== null
            && Object.keys(refInstance).every((key: string) => {
                return obj.hasOwnProperty(key);
            });
    }

    public static sleep(delayInMilliseconds: number): Promise<NodeJS.Timer> {
        return new Promise((resolve) => setTimeout(resolve, delayInMilliseconds));
    }

    public static throwIfNotInstanceOf<T>(value: unknown, name: string, refInstance: T, type: string): void {
        if (!this.hasAllPropertiesOf<T>(value, refInstance)) {
            throw new TypeError(Constants.NotInstanceOfTypeMessage
                .replace("{0}", name)
                .replace("{1}", type)
                .replace("{2}", typeof value)
            );
        }
    }

    public static throwIfNotNonEmptyString(value: unknown, name: string): void {
        if (typeof value !== "string" || !(value.trim())) {
            throw new TypeError(Constants.NotStringMessage
                .replace("{0}", name)
                .replace("{1}", typeof value));
        }
    }
}
