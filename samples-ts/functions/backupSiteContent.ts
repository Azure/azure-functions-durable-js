import * as df from "durable-functions";
import * as fs from "fs/promises";
import * as readdirp from "readdirp";
import * as path from "path";
import { InvocationContext, output } from "@azure/functions";
import {
    OrchestrationHandler,
    OrchestrationContext,
    ActivityHandler,
    Task,
} from "durable-functions";
import { Stats } from "fs";

const getFileListActivityName = "getFileList";
const copyFileToBlobActivityName = "copyFileToBlob";

const backupSiteContentOrchestration: OrchestrationHandler = function* (
    context: OrchestrationContext
) {
    const rootDir: string = context.df.getInput<string>();
    if (!rootDir) {
        throw new Error("A directory path is required as an input.");
    }

    const rootDirAbs: string = path.resolve(rootDir);
    const files: string[] = yield context.df.callActivity(getFileListActivityName, rootDirAbs);

    // Backup Files and save Promises into array
    const tasks: Task[] = [];
    for (const file of files) {
        const input = {
            backupPath: path.relative(rootDirAbs, file).replace("\\", "/"),
            filePath: file,
        };
        tasks.push(context.df.callActivity(copyFileToBlobActivityName, input));
    }

    // wait for all the Backup Files Activities to complete, sum total bytes
    const results: number[] = yield context.df.Task.all(tasks);
    const totalBytes: number = results ? results.reduce((prev, curr) => prev + curr, 0) : 0;

    // return results;
    return totalBytes;
};
df.app.orchestration("backupSiteContent", backupSiteContentOrchestration);

const getFileListActivity: ActivityHandler = async function (
    rootDirectory: string,
    context: InvocationContext
): Promise<string[]> {
    context.log(`Searching for files under '${rootDirectory}'...`);

    const allFilePaths = [];
    for await (const entry of readdirp(rootDirectory, { type: "files" })) {
        allFilePaths.push(entry.fullPath);
    }
    context.log(`Found ${allFilePaths.length} under ${rootDirectory}.`);
    return allFilePaths;
};

df.app.activity(getFileListActivityName, {
    handler: getFileListActivity,
});

const blobOutput = output.storageBlob({
    path: "backups/{backupPath}",
    connection: "StorageConnString",
});

const copyFileToBlobActivity: ActivityHandler = async function (
    { backupPath, filePath }: { backupPath: string; filePath: string },
    context: InvocationContext
): Promise<number> {
    const outputLocation = `backups/${backupPath}`;
    const stats: Stats = await fs.stat(filePath);
    context.log(`Copying '${filePath}' to '${outputLocation}'. Total bytes = ${stats.size}.`);

    const fileContents = await fs.readFile(filePath);

    context.extraOutputs.set(blobOutput, fileContents);

    return stats.size;
};
df.app.activity(copyFileToBlobActivityName, {
    extraOutputs: [blobOutput],
    handler: copyFileToBlobActivity,
});
