import * as debug from "debug";
import {
    DurableEntityBindingInfo,
    EntityId,
    EntityState,
    OperationResult,
    RequestMessage,
    Signal,
    Utils,
} from "./classes";
import { DurableEntityBindingInfoReqFields } from "./durableentitybindinginfo";
import { DurableEntityContext, EntityContext } from "./types";

/** @hidden */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const log = debug("orchestrator");

/** @hidden */
export class Entity<T> {
    constructor(public fn: (context: EntityContext<T>) => void) {}

    public listen(): (
        entityTrigger: DurableEntityBindingInfo,
        context: EntityContext<T>
    ) => Promise<EntityState> {
        return this.handle.bind(this);
    }

    private async handle(
        entityTrigger: DurableEntityBindingInfo,
        context: EntityContext<T>
    ): Promise<EntityState> {
        const entityBinding = Utils.getInstancesOf<DurableEntityBindingInfo>(
            { trigger: entityTrigger },
            new DurableEntityBindingInfoReqFields(
                new EntityId("samplename", "samplekey"),
                true,
                []
            ) as DurableEntityBindingInfo
        )[0];

        if (entityBinding === undefined) {
            throw new Error("Could not find an entityTrigger binding on context.");
        }

        // Setup
        const returnState: EntityState = new EntityState([], []);
        returnState.entityExists = entityBinding.exists;
        returnState.entityState = entityBinding.state;
        for (let i = 0; i < entityBinding.batch.length; i++) {
            const startTime = new Date();
            context.df = this.getCurrentDurableEntityContext(
                entityBinding,
                returnState,
                i,
                startTime
            );

            try {
                await Promise.resolve(this.fn(context));
                if (!returnState.results[i]) {
                    const elapsedMs = this.computeElapsedMilliseconds(startTime);
                    returnState.results[i] = new OperationResult(false, elapsedMs);
                }
            } catch (error) {
                const elapsedMs = this.computeElapsedMilliseconds(startTime);
                returnState.results[i] = new OperationResult(
                    true,
                    elapsedMs,
                    JSON.stringify(error)
                );
            }
        }

        return returnState;
    }

    private getCurrentDurableEntityContext(
        bindingInfo: DurableEntityBindingInfo,
        batchState: EntityState,
        requestIndex: number,
        startTime: Date
    ): DurableEntityContext<T> {
        const currentRequest = bindingInfo.batch[requestIndex];
        return {
            entityName: bindingInfo.self.name,
            entityKey: bindingInfo.self.key,
            entityId: bindingInfo.self,
            operationName: currentRequest.name,
            isNewlyConstructed: !batchState.entityExists,
            getState: this.getState.bind(this, batchState),
            setState: this.setState.bind(this, batchState),
            getInput: this.getInput.bind(this, currentRequest) as <TInput>() => TInput | undefined,
            return: this.return.bind(this, batchState, startTime) as <TResult = T>(
                value: TResult
            ) => void,
            destructOnExit: this.destructOnExit.bind(this, batchState),
            signalEntity: this.signalEntity.bind(this, batchState),
        };
    }

    private destructOnExit(batchState: EntityState): void {
        batchState.entityExists = false;
        batchState.entityState = undefined;
    }

    private getInput<TInput>(currentRequest: RequestMessage): TInput | undefined {
        if (currentRequest.input) {
            return JSON.parse(currentRequest.input) as TInput;
        }
        return undefined;
    }

    private getState(returnState: EntityState, initializer?: () => T): T | undefined {
        if (returnState.entityState) {
            return JSON.parse(returnState.entityState) as T;
        } else if (initializer) {
            return initializer();
        }
        return undefined;
    }

    private return(returnState: EntityState, startTime: Date, result: T): void {
        returnState.entityExists = true;
        returnState.results.push(
            new OperationResult(
                false,
                this.computeElapsedMilliseconds(startTime),
                JSON.stringify(result)
            )
        );
    }

    private setState(returnState: EntityState, state: T): void {
        returnState.entityExists = true;
        returnState.entityState = JSON.stringify(state);
    }

    private signalEntity(
        returnState: EntityState,
        entity: EntityId,
        operationName: string,
        operationInput?: unknown
    ): void {
        returnState.signals.push(
            new Signal(entity, operationName, operationInput ? JSON.stringify(operationInput) : "")
        );
    }

    private computeElapsedMilliseconds(startTime: Date): number {
        const endTime = new Date();
        return endTime.getTime() - startTime.getTime();
    }
}
