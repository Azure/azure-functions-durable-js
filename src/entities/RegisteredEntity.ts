import { TaskHubOptions } from "durable-functions";
import { CallEntityTask } from "../task/CallEntityTask";
import { EntityStateResponse } from "./EntityStateResponse";
import * as types from "durable-functions";

export abstract class RegisteredEntity<T = unknown> implements types.RegisteredEntity<T> {
    [key: string]: (
        input?: unknown,
        options?: TaskHubOptions
    ) => CallEntityTask | Promise<void> | Promise<EntityStateResponse<T>>;

    // constructor(id: string, orchestrationCont
    // constructor(id: string, durableClient: DurableClient);
    // abstract constructor(id: string, contextOrClient: OrchestrationContext | DurableClient);

    abstract readState(options?: TaskHubOptions): Promise<EntityStateResponse<T>>;

    // [P in keyof BaseClass]: (
    //     input?: unknown,
    //     options?: TaskHubOptions
    // ) => CallEntityTask | void | Promise<EntityStateResponse<T>>;

    // [key: string]: (
    //     input?: unknown,
    //     options?: TaskHubOptions
    // ) => CallEntityTask | void | Promise<EntityStateResponse<T>>;
}
