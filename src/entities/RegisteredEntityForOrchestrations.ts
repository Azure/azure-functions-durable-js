import * as types from "durable-functions";
import { CallEntityTask } from "../task/CallEntityTask";

export abstract class RegisteredEntityForOrchestrationsBase
    implements types.RegisteredEntityForOrchestrationsBase {
    [key: string]: (input?: unknown) => CallEntityTask;
}
