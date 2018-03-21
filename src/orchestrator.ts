import * as debug from "debug";

const log = debug("orchestrator");

export class Orchestrator {
    constructor(public fn: GeneratorFunction) { }

    public listen() {
        return this.handle.bind(this);
    }

    private async handle(context: any) {
        const state = context.req.body;

        context.df = {};
        context.df.callFunction = this.callFunction.bind(this, state);

        const f = this.fn(context);
        let results: any;
        while (true) {
            try {
                const g = f.next(results ?
                    (Array.isArray(results)
                        ? results.map((v) => v.input)
                        : results.input)
                    : undefined);
                if (g.done) {
                    log("Iterator is done");
                    this.finish(context, state, null, true, g.value);
                    return;
                }
                results = await g.value; // switch this to durable task's (it's a promise right now)
                if (Array.isArray(results)) {
                    const actions = results.filter((val: Action | StateItem) => {
                        return val instanceof Action;
                    });
                    if (actions.length > 0) {
                        log("Action received (array)");
                        this.finish(context, state, actions);
                        return;
                    }
                } else {
                    if (results instanceof Action) {
                        log("Action received");
                        this.finish(context, state, [results]);
                        return;
                    }
                }
            } catch (error) {
                this.error(context, error);
                return;
            }
        }
    }

    private callFunction(state: any, name: string, input: any = "__activity__default") {
        return new Promise((resolve, reject) => {
            if (input && state[name] && state[name][input]) {
                resolve(new StateItem(name, state[name][input]));
            } else {
                resolve(new Action("callFunction", name, input));
            }
        });
    }

    private finish(context: any, state: any, actions: any[], isDone: boolean = false, output?: any) {
        log("Finish called");
        context.res = {
            status: 200,
            body: {
                isDone,
                state,
                actions,
                output,
            },
        };

        context.done();
    }

    private error(context: any, err: any) {
        log(`Error: ${err}`);
        context.res = {
            status: 500,
            body: {
                error: err ? err : "An error occurred",
            },
        };
        context.done();
    }
}

// tslint:disable-next-line:max-classes-per-file
export class Action {
    constructor(
        public type: string,
        public name: string,
        public input: any,
    ) { }
}

// tslint:disable-next-line:max-classes-per-file
export class StateItem {
    constructor(
        public name: string,
        public input: any,
    ) { }
}
