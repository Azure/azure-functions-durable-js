/** @hidden */
export class Utils {
    // TODO: unit test
    public static getInstancesOf<T>(collection: { [index: string]: unknown }, refInstance: T): T[] {
        return collection
            ? Object.keys(collection)
                .filter((key: string) => this.hasAllPropertiesOf(refInstance, collection[key]))
                .map((key: string) => collection[key]) as T[]
            : [];
    }

    public static getHrMilliseconds(times: number[]): number {
        return times[0] * 1000 + times[1] / 1e6;
    }

    // TODO: unit test
    public static hasAllPropertiesOf<T>(refInstance: T, obj: unknown) {
        return Object.keys(refInstance).every((key: string) => {
            return typeof obj === "object" && obj.hasOwnProperty(key);
        });
    }

    public static sleep(delayInMilliseconds: number): Promise<NodeJS.Timer> {
        return new Promise((resolve) => setTimeout(resolve, delayInMilliseconds));
    }
}
