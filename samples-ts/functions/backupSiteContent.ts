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
const backupRootDirectorySettingName = "BACKUP_ROOT_DIRECTORY";

interface BackupFile {
    backupPath: string;
    filePath: string;
    rootDirectory: string;
}

const backupSiteContentOrchestration: OrchestrationHandler = function* (
    context: OrchestrationContext
) {
    const rootDir: unknown = context.df.getInput<unknown>();
    if (typeof rootDir !== "string" || !rootDir.trim()) {
        throw new Error("A directory path is required as an input.");
    }

    const files: BackupFile[] = yield context.df.callActivity(getFileListActivityName, rootDir);

    // Backup Files and save Tasks into array
    const tasks: Task[] = [];
    for (const file of files) {
        tasks.push(context.df.callActivity(copyFileToBlobActivityName, file));
    }

    // wait for all the Backup Files Activities to complete, sum total bytes
    const results: number[] = yield context.df.Task.all(tasks);
    const totalBytes: number = results ? results.reduce((prev, curr) => prev + curr, 0) : 0;

    // return results;
    return totalBytes;
};
df.app.orchestration("backupSiteContent", backupSiteContentOrchestration);

const getFileListActivity: ActivityHandler = async function (
    requestedRootDirectory: string,
    context: InvocationContext
): Promise<BackupFile[]> {
    const backupRootDirectory = await getBackupRootDirectory();
    const rootDirectory = await resolvePathWithinRoot(
        backupRootDirectory,
        requestedRootDirectory
    );
    context.log(`Searching for files under '${rootDirectory}'...`);

    const allFiles: BackupFile[] = [];
    for await (const entry of readdirp(rootDirectory, { type: "files" })) {
        const filePath = await resolvePathWithinRoot(rootDirectory, entry.fullPath);
        allFiles.push({
            backupPath: path.relative(rootDirectory, filePath).replace(/\\/g, "/"),
            filePath,
            rootDirectory,
        });
    }
    context.log(`Found ${allFiles.length} under ${rootDirectory}.`);
    return allFiles;
};

df.app.activity(getFileListActivityName, {
    handler: getFileListActivity,
});

const blobOutput = output.storageBlob({
    path: "backups/{backupPath}",
    connection: "StorageConnString",
});

const copyFileToBlobActivity: ActivityHandler = async function (
    input: BackupFile,
    context: InvocationContext
): Promise<number> {
    if (
        !input ||
        typeof input.backupPath !== "string" ||
        typeof input.filePath !== "string" ||
        typeof input.rootDirectory !== "string"
    ) {
        throw new Error("A valid backup file is required as an input.");
    }

    const backupRootDirectory = await getBackupRootDirectory();
    const rootDirectory = await resolvePathWithinRoot(
        backupRootDirectory,
        input.rootDirectory
    );
    const filePath = await resolvePathWithinRoot(rootDirectory, input.filePath);
    const backupPath = path.relative(rootDirectory, filePath).replace(/\\/g, "/");
    if (input.backupPath !== backupPath) {
        throw new Error("The backup path does not match the source file path.");
    }

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

async function getBackupRootDirectory(): Promise<string> {
    const configuredRootDirectory =
        process.env[backupRootDirectorySettingName] || process.cwd();
    return fs.realpath(path.resolve(configuredRootDirectory));
}

async function resolvePathWithinRoot(
    rootDirectory: string,
    requestedPath: unknown
): Promise<string> {
    if (typeof requestedPath !== "string" || !requestedPath.trim()) {
        throw new Error("A non-empty path is required.");
    }

    const resolvedPath = await fs.realpath(path.resolve(rootDirectory, requestedPath));
    const relativePath = path.relative(rootDirectory, resolvedPath);
    if (
        relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
    ) {
        throw new Error(
            `The requested path must be within the ${backupRootDirectorySettingName} directory.`
        );
    }

    return resolvedPath;
}
