/** @hidden */
export class HistoryEventOptions {
    public details?: string;
    public fireAt?: Date;
    public input?: string;
    public instanceId?: string;
    public name?: string;
    public reason?: string;
    public result?: string;
    public taskScheduledId?: number;
    public timerId?: number;

    constructor(public eventId: number, public timestamp: Date, public isPlayed: boolean = false) {}
}
