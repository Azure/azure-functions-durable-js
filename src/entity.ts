import { DurableEntityBindingInfo, EntityState, IEntityFunctionContext } from "./classes";
import { EntityId } from ".";

/** @hidden */
export class Entity {
    constructor(public fn: (context: IEntityFunctionContext) => unknown) { }

    public listen() {
        return this.handle.bind(this);
    }

    private async handle(context: IEntityFunctionContext): Promise<void> {
        const entityBindingInfo = context.bindingDefinitions
            .filter((binding) => binding.type === "entityTrigger")[0];

        if (entityBindingInfo === undefined) {
            throw new Error("Could not find an entityTrigger binding on context.");
        }

        const entityBinding: DurableEntityBindingInfo = context.bindings[entityBindingInfo.name];
        const entityId: EntityId = entityBinding.self;

        // Setup
        const returnState: EntityState = new EntityState();

        context.df = {
            entityName: entityId.entityName,
            entityKey: entityId.entityKey,
            entityId,
            operationName: undefined,       // TODO
            isNewlyConstructed: !entityBinding.exists,
            getState: this.getState.bind(this, returnState),    // TODO
            setState: this.setState.bind(this, returnState), // TODO
            getInput: this.getInput.bind(this, undefined),  // TODO
            return: this.return.bind(this), // TODO
            destructOnExit: this.destructOnExit.bind(this), // TODO
            signalEntity: this.signalEntity.bind(this), // TODO
        };

        try {
            this.fn(context);

            context.done(
                null,
                returnState,
            );
            return;
        } catch (error) {
            context.done(
                error,
                new EntityState(),
            );
            return;
        }
    }

    private destructOnExit(): void {
        throw new Error("Not yet implemented.");
    }

    private getInput<TInput>(input: unknown): TInput {
        throw new Error("Not yet implemented.");
    }

    private getState<TState>(returnState: EntityState, initializer: () => TState): TState {
        throw new Error("Not yet implemented.");
    }

    private return(result: unknown): void {
        throw new Error("Not yet implemented.");
    }

    private setState(returnState: EntityState, state: unknown): void {
        returnState.entityState = JSON.stringify(state);    // TODO: do something else here with intermediate object, don't serialize until end
    }

    private signalEntity(entity: EntityId, operationName: string, operationInput?: unknown): void {
        throw new Error("Not yet implemented.");
    }
}
