const df = require("../../../lib/");

module.exports = df(function*(context){
    context.log("Starting fan in/fan out sample");

    // Fetch files from GetFiles Activity Function
    const files = yield context.df.callActivityAsync("E2_GetFiles");

    // Backup Files and save Promises into array
    const tasks = [];
    for (const file of files) {
        tasks.push(context.df.callActivityAsync("E2_BackupFile", file));
    }

    // wait for all the Backup Files Activities to complete, sum total bytes
    const results = yield context.df.Task.all(tasks);
    const totalBytes = results.reduce((prev, curr) => prev + curr, 0);

    // return results;
    return totalBytes;
});