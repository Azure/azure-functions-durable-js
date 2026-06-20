// Critical sections sample (TypeScript) — atomic two-entity transfer.
//
// Demonstrates the `lock` API for atomically coordinating updates across
// two entities. Requires azure-functions-durable-extension with OOProc
// schema V4 or newer.
//
// This file uses the `try/finally` pattern so it compiles on the
// samples-ts toolchain (TypeScript 4.x). On TypeScript >= 5.2, prefer
// the more ergonomic `using` syntax:
//
//   using lock = (yield context.df.lock(src, dst)) as DurableLock;
//   // ...critical section... (released at block exit, even on throw)

import * as df from "durable-functions";
import {
    DurableLock,
    EntityContext,
    EntityHandler,
    OrchestrationContext,
    OrchestrationHandler,
} from "durable-functions";

const accountEntityName = "transferAccount";

const accountEntity: EntityHandler<number> = async function (
    context: EntityContext<number>
): Promise<void> {
    await Promise.resolve();
    let balance: number = context.df.getState(() => 0);

    switch (context.df.operationName) {
        case "add":
            balance += context.df.getInput<number>();
            break;
        case "get":
            context.df.return(balance);
            break;
    }

    context.df.setState(balance);
};
df.app.entity(accountEntityName, accountEntity);

interface TransferInput {
    fromKey: string;
    toKey: string;
    amount: number;
}

const transferOrchestration: OrchestrationHandler = function* (context: OrchestrationContext) {
    const { fromKey, toKey, amount } = context.df.getInput<TransferInput>();
    const src = new df.EntityId(accountEntityName, fromKey);
    const dst = new df.EntityId(accountEntityName, toKey);

    const lock = (yield context.df.lock(src, dst)) as DurableLock;
    try {
        const balance: number = yield context.df.callEntity(src, "get");
        if (balance >= amount) {
            yield context.df.callEntity(src, "add", -amount);
            yield context.df.callEntity(dst, "add", amount);
            return { transferred: true, locks: lock.ownedLocks.length };
        }
        return { transferred: false, reason: "insufficient funds" };
    } finally {
        lock.release();
    }
};
df.app.orchestration("transferEntities", transferOrchestration);
