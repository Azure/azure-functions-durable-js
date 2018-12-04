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

    public static hasAllPropertiesOf<T>(obj: unknown, refInstance: T) {
        return typeof refInstance === "object"
            && typeof obj === "object"
            && Object.keys(refInstance).every((key: string) => {
                return obj.hasOwnProperty(key);
            });
    }

    public static sleep(delayInMilliseconds: number): Promise<NodeJS.Timer> {
        return new Promise((resolve) => setTimeout(resolve, delayInMilliseconds));
    }
}
