import {
    EntityClass,
    OrchestrationContext,
    RegisterEntityResult,
    TaskHubOptions,
} from "durable-functions";
import { EntityStateResponse } from "./EntityStateResponse";
import { EntityId } from "./EntityId";
import { DurableClient } from "../durableClient/DurableClient";
import { DurableOrchestrationContext } from "../orchestrations/DurableOrchestrationContext";
import { CallEntityTask } from "../task/CallEntityTask";
import { DurableError } from "../error/DurableError";
import { RegisteredEntity } from "./RegisteredEntity";

export function getRegisterEntityResult<
    T = unknown,
    BaseClass extends EntityClass<T> = EntityClass<T>
>(
    entityName: string,
    entityClass: new (...args: any[]) => EntityClass<T>
): RegisterEntityResult<T, BaseClass> {
    const registeredEntity = class extends RegisteredEntity<T> {
        #entityName: string = entityName;
        #entityClass: new (...args: any[]) => EntityClass<T> = entityClass;
        #entityId: EntityId;
        #orchestrationContext?: OrchestrationContext;
        #durableClient?: DurableClient;

        constructor(id: string, contextOrClient: OrchestrationContext | DurableClient) {
            // super(entityId, contextOrClient);
            super();
            this.#entityId = new EntityId(this.#entityName, id);
            if (
                "df" in contextOrClient &&
                contextOrClient.df instanceof DurableOrchestrationContext
            ) {
                this.#orchestrationContext = contextOrClient;
            } else if (contextOrClient instanceof DurableClient) {
                this.#durableClient = contextOrClient;
            }

            const instance: EntityClass<T> = new this.#entityClass();
            const propertyNames: string[] = Object.getOwnPropertyNames(this.#entityClass.prototype);
            propertyNames.map((propertyName) => {
                if (
                    propertyName !== "constructor" &&
                    typeof instance[propertyName] === "function"
                ) {
                    if (this.#orchestrationContext) {
                        this.convertToOrchestrationMethod(propertyName);
                    } else if (this.#durableClient) {
                        this.convertToClientMethod(propertyName);
                    }
                }
            });
        }

        readState(options?: TaskHubOptions): Promise<EntityStateResponse<T>> {
            if (!this.#durableClient) {
                throw new Error("Client must be passed to constructor");
            }
            return this.#durableClient.readEntityState(this.#entityId, options);
        }

        private async convertToOrchestrationMethod(propertyName: string): Promise<void> {
            this[propertyName] = (input?: unknown): CallEntityTask => {
                if (!this.#orchestrationContext) {
                    throw new Error("OrchestrationContext must be passed to constructor");
                }

                return new CallEntityTask(
                    this.#orchestrationContext,
                    this.#entityId,
                    propertyName,
                    input
                );
            };
        }

        private async convertToClientMethod(propertyName: string): Promise<void> {
            this[propertyName] = async (
                input?: unknown,
                options?: TaskHubOptions
            ): Promise<void> => {
                if (!this.#durableClient) {
                    throw new DurableError("Client must be passed to constructor");
                }

                return await this.#durableClient.signalEntity(
                    this.#entityId,
                    propertyName,
                    input,
                    options
                );
            };
        }
    };

    return registeredEntity as RegisterEntityResult<T, BaseClass>;
}
