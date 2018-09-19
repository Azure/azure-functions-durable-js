import { IAction } from "./classes";

export class OrchestratorState {
    constructor(
        public isDone: boolean,
        public actions: IAction[][],
        public output: any,
        public customStatus?: any,
    ) { }
}
