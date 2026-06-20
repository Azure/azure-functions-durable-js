// Critical sections sample (JavaScript, `try/finally` — primary JS pattern).
//
// Works on all supported Node versions (18+). Requires
// azure-functions-durable-extension with OOProc schema V4 or newer.
//
// For Node >= 24 (or Node 22 with --harmony-explicit-resource-management),
// see `transferUsing.js` for the more ergonomic `using` form.

const df = require("durable-functions");

df.app.entity("transferAccount", async function (context) {
    let balance = context.df.getState(() => 0);
    switch (context.df.operationName) {
        case "add":
            balance += context.df.getInput();
            break;
        case "get":
            context.df.return(balance);
            break;
    }
    context.df.setState(balance);
});

df.app.orchestration("transferTryFinally", function* (context) {
    const { fromKey, toKey, amount } = context.df.getInput();
    const src = new df.EntityId("transferAccount", fromKey);
    const dst = new df.EntityId("transferAccount", toKey);

    const lock = yield context.df.lock(src, dst);
    try {
        const balance = yield context.df.callEntity(src, "get");
        if (balance >= amount) {
            yield context.df.callEntity(src, "add", -amount);
            yield context.df.callEntity(dst, "add", amount);
            return { transferred: true };
        }
        return { transferred: false, reason: "insufficient funds" };
    } finally {
        lock.release();
    }
});
