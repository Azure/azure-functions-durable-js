module.exports = function (context) {
    context.log("Flaky Function Flaking!");
    throw Error("FlakyFunction flaked");
};
