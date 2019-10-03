import * as debug from "debug";
import { DurableEntityBindingInfo, DurableEntityContext, EntityId, EntityState, IEntityFunctionContext,
    OperationResult, RequestMessage, Signal, Utils } from "./classes";

/** @hidden */
const log = debug("orchestrator");

/** @hidden */
export class Entity {
    constructor(public fn: (context: IEntityFunctionContext) => unknown) { }

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
            const startTime = new Date();
            context.df = this.getCurrentDurableEntityContext(entityBinding, returnState, i, startTime);

            try {
                this.fn(context);
                if (!returnState.results[i]) {
                    const elapsedMs = this.computeElapsedMilliseconds(startTime);
                    returnState.results[i] = new OperationResult(false, elapsedMs);
                }
            } catch (error) {
                const elapsedMs = this.computeElapsedMilliseconds(startTime);
                returnState.results[i] = new OperationResult(true, elapsedMs, JSON.stringify(error));
            }
        }

        context.done(null, returnState);
    }

    private getCurrentDurableEntityContext(bindingInfo: DurableEntityBindingInfo, batchState: EntityState, requestIndex: number, startTime: Date): DurableEntityContext  {
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
            return: this.return.bind(this, batchState, startTime),
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
            const typedInput = JSON.parse(currentRequest.input) as TInput;
            if (!typedInput) {
                throw Error("Cannot parse " + currentRequest.input + " as the required type.");
            }
            return typedInput;
        }
        return undefined;
    }

    private getState<TState>(returnState: EntityState, initializer?: () => TState): TState | undefined {
        if (returnState.entityState) {
            const typedState = JSON.parse(returnState.entityState) as TState;
            if (!typedState) {
                throw Error("Cannot parse " + returnState.entityState + " as the required type.");
            }
            return typedState;
        } else if (initializer != null) {
            return initializer();
        }
        return undefined;
    }

    private return<TResult>(returnState: EntityState, startTime: Date, result: TResult): void {
        returnState.entityExists = true;
        returnState.results.push(new OperationResult(false, this.computeElapsedMilliseconds(startTime), JSON.stringify(result)));
    }

    private setState<TState>(returnState: EntityState, state: TState): void {
        returnState.entityExists = true;
        returnState.entityState = JSON.stringify(state);
    }

    private signalEntity(returnState: EntityState, entity: EntityId, operationName: string, operationInput?: unknown): void {
        returnState.signals.push(new Signal(entity, operationName, operationInput ? JSON.stringify(operationInput) : ""));
    }

    private computeElapsedMilliseconds(startTime: Date) : number {
        const endTime = new Date();
        return endTime.getTime() - startTime.getTime();
    }
}
