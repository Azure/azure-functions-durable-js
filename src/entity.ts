import * as debug from "debug";
import { DurableEntityBindingInfo, DurableEntityContext, EntityId, EntityState, IEntityFunctionContext,
    OperationResult, RequestMessage, Signal, Utils } from "./classes";

/** @hidden */
const log = debug("orchestrator");

/** @hidden */
export class Entity {
    constructor(public fn: (context: IEntityFunctionContext) => IterableIterator<unknown>) { }

    public listen() {
        return this.handle.bind(this);
    }

    private async handle(context: IEntityFunctionContext): Promise<void> {
        const entityBinding = Utils.getInstancesOf<DurableEntityBindingInfo>(
            context.bindings, new DurableEntityBindingInfo(null, null, null, []))[0];

        if (entityBinding === undefined) {
            throw new Error("Could not find an entityTrigger binding on context.");
        }

        // Setup
        const returnState: EntityState = new EntityState([], []);
        returnState.entityExists = entityBinding.exists;
        returnState.entityState = entityBinding.state;

        for (let i = 0; i < entityBinding.batch.length; i++) {
            context.df = this.getCurrentDurableEntityContext(entityBinding, returnState, i);

            try {
                const gen = this.fn(context);
                gen.next();
                if (!returnState.results[i]) {
                    returnState.results[i] = new OperationResult(null, false, -1); // TODO handle duration later.
                }
            } catch (error) {
                returnState.results[i] = new OperationResult(JSON.stringify(error), true, -1); // TODO handle duration later.
            }
        }

        context.done(null, returnState);
    }

    private getCurrentDurableEntityContext(bindingInfo: DurableEntityBindingInfo, batchState: EntityState, requestIndex: number): DurableEntityContext  {
        const currentRequest = bindingInfo.batch[requestIndex];
        return {
            entityName: bindingInfo.self.name,
            entityKey: bindingInfo.self.key,
            entityId: bindingInfo.self,
            operationName: currentRequest.name,
            isNewlyConstructed: !batchState.entityExists,
            getState: this.getState.bind(this, batchState),
            setState: this.setState.bind(this, batchState),
            getInput: this.getInput.bind(this, currentRequest),
            return: this.return.bind(this, batchState),
            destructOnExit: this.destructOnExit.bind(this, batchState),
            signalEntity: this.signalEntity.bind(this, batchState),
        };
    }

    private destructOnExit(batchState: EntityState): void {
        batchState.entityExists = false;
        batchState.entityState = undefined;
    }

    private parseObject(objectString: string): unknown {
        return JSON.parse(objectString);
    }

    private getInput<TInput>(currentRequest: RequestMessage): TInput | undefined {
        if (currentRequest.input) {
            try {
                return this.parseObject(currentRequest.input) as TInput;
            } catch {
                throw Error("Cannot parse " + currentRequest.input + "as the required type.");
            }
        }
        return undefined;
    }

    private getState<TState>(returnState: EntityState, initializer?: () => TState): TState | undefined {
        if (returnState.entityState) {
            try {
                return this.parseObject(returnState.entityState) as TState;
            } catch {
                throw Error("Cannot parse " + returnState.entityState + "as the required type.");
            }
        } else if (initializer != null) {
            return initializer();
        }
        throw Error("Entity has no state, and no initializer passed into getState() method.");
    }

    private return<TResult>(returnState: EntityState, result: TResult): void {
        returnState.entityExists = true;
        returnState.results.push(new OperationResult(JSON.stringify(result), false, -1)); // TODO: put actual duration in place.
    }

    private setState<TState>(returnState: EntityState, state: TState): void {
        returnState.entityExists = true;
        returnState.entityState = JSON.stringify(state);
    }

    private signalEntity(returnState: EntityState, entity: EntityId, operationName: string, operationInput?: unknown): void {
        returnState.signals.push(new Signal(entity, operationName, operationInput ? JSON.stringify(operationInput) : ""));
    }
}
