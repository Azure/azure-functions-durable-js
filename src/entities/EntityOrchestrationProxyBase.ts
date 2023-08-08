import * as types from "durable-functions";
import { CallEntityTask } from "../task/CallEntityTask";

export abstract class EntityOrchestrationProxyBase implements types.EntityOrchestrationProxyBase {
    [key: string]: (input?: unknown) => CallEntityTask;
}
