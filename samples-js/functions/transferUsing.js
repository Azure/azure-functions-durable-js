// Critical sections sample (JavaScript, `using` — requires Node >= 24
// unflagged, or Node 22 with --harmony-explicit-resource-management).
//
// Use `transferTryFinally.js` instead on older Node runtimes.

const df = require("durable-functions");

// Re-uses `transferAccount` entity from transferTryFinally.js.

df.app.orchestration("transferUsing", function* (context) {
    const { fromKey, toKey, amount } = context.df.getInput();
    const src = new df.EntityId("transferAccount", fromKey);
    const dst = new df.EntityId("transferAccount", toKey);

    using lock = yield context.df.lock(src, dst);

    const balance = yield context.df.callEntity(src, "get");
    if (balance >= amount) {
        yield context.df.callEntity(src, "add", -amount);
        yield context.df.callEntity(dst, "add", amount);
        return { transferred: true, lockedEntities: lock.ownedLocks.length };
    }
    return { transferred: false, reason: "insufficient funds" };
});
