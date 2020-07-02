const df = require("durable-functions");

module.exports = df.orchestrator(function* (context) {
    const input = context.df.getInput();

    throw Error("ThrowsErrorInline does what it says on the tin.");
});
