const df = require("../../lib/src");

module.exports = df.entity(async function (context) {
    context.df.setState(1);
    context.df.setState(2);
});
