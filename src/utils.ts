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
            throw new TypeError(`${name}: Expected object of type ${type} but got ${typeof value}; are you missing properties?`);
        }
    }

    public static throwIfEmpty(value: unknown, name: string): void {
        if (typeof value !== "string" || value.trim().length < 1) {
            throw new TypeError(`${name}: Expected non-empty, non-whitespace string but got ${typeof value}`);
        }
    }

    public static throwIfNotNumber(value: unknown, name: string): void {
        if (typeof value !== "number") {
            throw new TypeError(`${name}: Expected number but got ${typeof value}`);
        }
    }
}
