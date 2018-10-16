export class Utils {
    public static getHrMilliseconds(times: number[]): number {
        return times[0] * 1000 + times[1] / 1e6;
    }

    public static sleep(delayInMilliseconds: number): Promise<NodeJS.Timer> {
        return new Promise((resolve) => setTimeout(resolve, delayInMilliseconds));
    }
}
