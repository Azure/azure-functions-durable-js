import {
    EntityClass,
    OrchestrationContext,
    RegisteredEntity,
    RegisteredEntityForClients,
    RegisteredEntityForOrchestrations,
    TaskHubOptions,
} from "durable-functions";
import { EntityStateResponse } from "./EntityStateResponse";
import { EntityId } from "./EntityId";
import { DurableClient } from "../durableClient/DurableClient";
import { CallEntityTask } from "../task/CallEntityTask";
import { RegisteredEntityForOrchestrationsBase } from "./RegisteredEntityForOrchestrations";
import { RegisteredEntityForClientsBase } from "./RegisteredEntityForClients";

export function getRegisterEntityResult<
    T = unknown,
    BaseClass extends EntityClass<T> = EntityClass<T>
>(
    entityName: string,
    entityClass: new (...args: any[]) => EntityClass<T>
): RegisteredEntity<T, BaseClass> {
    const registeredEntityForOrchestrations: RegisteredEntityForOrchestrations<
        T,
        BaseClass
    > = (class extends RegisteredEntityForOrchestrationsBase {
        #entityName: string = entityName;
        #entityClass: new (...args: any[]) => EntityClass<T> = entityClass;
        #entityId: EntityId;
        #orchestrationContext: OrchestrationContext;

        constructor(id: string, context: OrchestrationContext) {
            super();
            this.#entityId = new EntityId(this.#entityName, id);
            this.#orchestrationContext = context;

            const instance: EntityClass<T> = new this.#entityClass();
            const propertyNames: string[] = Object.getOwnPropertyNames(this.#entityClass.prototype);
            propertyNames.map((propertyName) => {
                if (
                    propertyName !== "constructor" &&
                    typeof instance[propertyName] === "function"
                ) {
                    this[propertyName] = (input?: unknown): CallEntityTask => {
                        return new CallEntityTask(
                            this.#orchestrationContext,
                            this.#entityId,
                            propertyName,
                            input
                        );
                    };
                }
            });
        }
    } as unknown) as RegisteredEntityForOrchestrations<T, BaseClass>;

    const registeredEntityForClients: RegisteredEntityForClients<
        T,
        BaseClass
    > = class extends RegisteredEntityForClientsBase<T> {
        #entityName: string = entityName;
        #entityClass: new (...args: any[]) => EntityClass<T> = entityClass;
        #entityId: EntityId;
        #durableClient: DurableClient;

        constructor(id: string, client: DurableClient) {
            super();
            this.#entityId = new EntityId(this.#entityName, id);
            this.#durableClient = client;

            const instance: EntityClass<T> = new this.#entityClass();
            const propertyNames: string[] = Object.getOwnPropertyNames(this.#entityClass.prototype);
            propertyNames.map((propertyName) => {
                if (
                    propertyName !== "constructor" &&
                    typeof instance[propertyName] === "function"
                ) {
                    this[propertyName] = async (
                        input?: unknown,
                        options?: TaskHubOptions
                    ): Promise<void> => {
                        return await this.#durableClient.signalEntity(
                            this.#entityId,
                            propertyName,
                            input,
                            options
                        );
                    };
                }
            });
        }

        readState(options?: TaskHubOptions): Promise<EntityStateResponse<T>> {
            if (!this.#durableClient) {
                throw new Error("Client must be passed to constructor");
            }
            return this.#durableClient.readEntityState(this.#entityId, options);
        }
    } as RegisteredEntityForClients<T, BaseClass>;

    return {
        orchestration: registeredEntityForOrchestrations,
        client: registeredEntityForClients,
    };
}
