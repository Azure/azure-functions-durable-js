import {
    ActivityOptions,
    EntityClass,
    EntityContext,
    EntityHandler,
    EntityOptions,
    OrchestrationHandler,
    OrchestrationOptions,
    RegisterEntityResult,
    RegisteredActivity,
    RegisteredOrchestration,
} from "durable-functions";
import * as trigger from "./trigger";
import { createOrchestrator, createEntityFunction } from "./util/testingUtils";
import { app as azFuncApp } from "@azure/functions";
import { RegisteredOrchestrationTask } from "./task/RegisteredOrchestrationTask";
import { RegisteredActivityTask } from "./task/RegisteredActivityTask";
import { DurableError } from "./error/DurableError";
import { getRegisterEntityResult } from "./entities/getRegisterEntityResult";

export function orchestration(
    functionName: string,
    handlerOrOptions: OrchestrationHandler | OrchestrationOptions
): RegisteredOrchestration {
    const options: OrchestrationOptions =
        typeof handlerOrOptions === "function" ? { handler: handlerOrOptions } : handlerOrOptions;

    azFuncApp.generic(functionName, {
        trigger: trigger.orchestration(),
        ...options,
        handler: createOrchestrator(options.handler),
    });

    const result: RegisteredOrchestration = (
        input?: unknown,
        instanceId?: string
    ): RegisteredOrchestrationTask => {
        return new RegisteredOrchestrationTask(functionName, input, instanceId);
    };

    return result;
}

export function entity<T = unknown>(
    functionName: string,
    handlerOrOptions: EntityHandler<T> | EntityOptions<T>
): void {
    const options: EntityOptions<T> =
        typeof handlerOrOptions === "function" ? { handler: handlerOrOptions } : handlerOrOptions;

    azFuncApp.generic(functionName, {
        trigger: trigger.entity(),
        ...options,
        handler: createEntityFunction(options.handler),
    });
}

export function classEntity<T = unknown, Base extends EntityClass<T> = EntityClass<T>>(
    entityName: string,
    entityClass: new (...args: any[]) => Base
): RegisterEntityResult<T, Base> {
    const handler: EntityHandler<T> = (context: EntityContext<T>) => {
        if (!context.df.operationName) {
            throw new DurableError(
                `The operation name was not defined. Please pass an operation name when calling or signalling the ${entityName} entity.`
            );
        }

        const entityClassInstance = new entityClass();
        const state: T | undefined = context.df.getState(() => entityClassInstance.state);
        if (state !== undefined) {
            entityClassInstance.state = state;
        }

        const input: T | undefined = context.df.getInput();
        if (typeof entityClassInstance[context.df.operationName] !== "function") {
            throw new DurableError(
                `An operation with this name: ${context.df.operationName} is not a callable method.` +
                    ` Please make sure you only call methods on the entity class.`
            );
        }

        const result = (entityClassInstance[context.df.operationName] as Function)(input);
        if (typeof result !== "undefined") {
            context.df.return(result);
        }
        context.df.setState(entityClassInstance.state);
    };

    entity(entityName, handler);

    return getRegisterEntityResult(entityName, entityClass);
}

export function activity(functionName: string, options: ActivityOptions): RegisteredActivity {
    azFuncApp.generic(functionName, {
        trigger: trigger.activity(),
        ...options,
    });

    const result: RegisteredActivity = (input?: unknown): RegisteredActivityTask => {
        return new RegisteredActivityTask(functionName, input);
    };

    return result;
}
