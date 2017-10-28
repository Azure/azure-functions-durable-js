
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
        let results: any = undefined;
        while (true) {
            try {
                let g = f.next(results ? results.input : undefined);
                if (g.done) {
                    console.log("Iterator is done");
                    this.finish(context, state, null, true);
                    return;
                }
                results = await g.value;
                if (Array.isArray(results.value)) {
                    let actions = results.filter((val: Action | StateItem) => {
                        return val instanceof Action;
                    });
                    if (actions.length > 0) {
                        console.log("Action received (array)");
                        this.finish(context, state, actions);
                        return;
                    }
                } else {
                    if (results instanceof Action) {
                        console.log("Action received");
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

    private callFunction(state: any, name: string, input: any) {
        return new Promise((resolve, reject) => {
            if (state[name] && state[name][input]) {
                resolve(new StateItem(name, state[name][input]));
            } else {
                resolve(new Action("callFunction", name, input));
            }
        });
    }

    private finish(context: any, state: any, actions: any[], isDone: boolean = false ) {
        console.log("Finish called");
        context.res = {
            status: 200,
            body: {
                isDone,
                state,
                actions,
            },
        };
        context.done();
    }

    private error(context: any, err: any) {
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