const df = require("../../lib/src");

module.exports = df.orchestrator(function*(context){
    const input = context.df.getInput();

    const entity = new df.EntityId("StringStoreEntity2", input);

    const output = yield context.df.callEntity(entity, "set", "333");
    
    return output;
});