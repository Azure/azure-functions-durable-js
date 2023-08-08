import * as types from "durable-functions";
import { TaskHubOptions } from "durable-functions";
import { EntityStateResponse } from "./EntityStateResponse";

export abstract class EntityClientProxyBase<T = unknown> implements types.EntityClientProxyBase<T> {
    abstract readState(options?: TaskHubOptions): Promise<EntityStateResponse<T>>;

    [key: string]: (
        input?: unknown,
        options?: TaskHubOptions
    ) => Promise<void> | Promise<EntityStateResponse<T>>;
}
