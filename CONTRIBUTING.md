# Contributor Onboarding

## General

- Helps start contributions to Durable Functions in JavaScript
- Helps setup development environment across platforms for Durable Functions in JavaScript

## Pre-reqs

- OS
    - MacOS (or) Windows10
- Language Runtimes
    - .NET Core 2.0
    - Python 3.6.x
- Editor
    - VS Code (or) Visual Studio
- Tools
    - [Azurite V2](https://github.com/Azure/Azurite/tree/legacy-master) (for MacOS) (or) [Azure Storage Emulator](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-emulator) (or) Storage account in Azure
    - [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools) v2.7.x and above.

## Change flow

The general flow for making a change to the script host is:
1. 🍴 Fork the repo (add the fork via `git remote add me <clone url here>`
2. 🌳 Create a branch for your change (generally branch from dev) (`git checkout -b my-change`)
3. 🛠 Make your change
4. ✔️ Test your changes
5. ⬆️ Push your changes to your fork (`git push me my-change`)
6. 💌 Open a PR to the dev branch
7. 📢 Address feedback and make sure tests pass (yes even if it's an "unrelated" test failure)
8. 📦 [Rebase](https://git-scm.com/docs/git-rebase) your changes into a meaningful commits (`git rebase -i HEAD~N` where `N` is commits you want to squash)
9. :shipit: Rebase and merge (This will be done for you if you don't have contributor access)
10. ✂️ Delete your branch (optional)

## End to End Development Setup: JavaScript library + Durable Extension (MacOS)

### Setting up Azurite V2

Note: [Azurite V3](https://github.com/Azure/Azurite) does not have support for Table Storage yet. So falling back to [Azurite V2](https://github.com/Azure/Azurite/tree/legacy-master) setup.

Create a folder say AzureWebJobsStorage

`npm install azurite@2.7.1 -g`

`azurite -l ./AzureWebJobsStorage`

```
 _______                   _             
(_______)                 (_)  _         
 _______ _____ _   _  ____ _ _| |_ _____ 
|  ___  (___  ) | | |/ ___) (_   _) ___ |
| |   | |/ __/| |_| | |   | | | |_| ____|
|_|   |_(_____)____/|_|   |_| \__)_____)
                                         
Azurite, Version 2.7.1
A lightweight server clone of Azure Storage

Azure Table Storage Emulator listening on port 10002
Azure Queue Storage Emulator listening on port 10001
Azure Blob Storage Emulator listening on port 10000
```

### Visual Studio Code Extensions

The following extensions should be installed if using Visual Studio Code for debugging:

- C# for Visual Studio Code (powered by OmniSharp)
- Azure Functions Extensions for Visual Studio Code v0.19.1 and above.

### Setting up durable-js debugging

- Create a Durable Functions Orchestrator for FunctionChaining pattern using [starter templates](https://docs.microsoft.com/en-us/azure/azure-functions/durable/quickstart-js-vscode)
  Note: In this starter template, ignore the line that says: "On a Mac or Linux computer, you must set the AzureWebJobsStorage property to the connection string of an existing Azure storage account". We will be setting up the AzureWebJobsStorage property to `UseDevelopmentStorage=true`

- In host.json, remove the extensionsBundle portion to enable specific version debugging. Provide a hub name (else remove the entire extensions portion to default to DurableFunctionsHub) Here's how the host.json should look like:

```
{
  "version": "2.0",
  "extensions": {
    "durableTask": {
      "hubName": "{hubName}"
    }
  }
}
```

- `func extensions install` (this will install an extensions.csproj that contains the version of DurableTask as seen below)

```xml <ItemGroup>
    <PackageReference Include="Microsoft.Azure.WebJobs.Extensions.DurableTask" Version="1.8.2" />
    <PackageReference Include="Microsoft.Azure.WebJobs.Script.ExtensionsMetadataGenerator" Version="1.1.0" />
  </ItemGroup>
```

### Setting up Durable Extension .NET debugging

- Download the source code of DurableTask extension from [here](https://www.nuget.org/packages/Microsoft.Azure.WebJobs.Extensions.DurableTask)
- In launch.json, add requireExactSource and justMyCode fields for .NET Core Attach task.

```
 {
            "name": ".NET Core Attach",
            "type": "coreclr",
            "request": "attach",
            "processId": "${command:pickProcess}",
            "requireExactSource": false,
            "justMyCode": false
 }
 ```

### Debugging end-to-end

1. Open the Azure Storage Explorer and connect to the local storage emulator or the storage account you are using.
2. In the VSCode editor for durable-js click Debug -> Start Debugging. This will internally start `func host start` through core tools and provides the orchestrator client URL
3. In the VSCode editor for DurableTask, click Debug -> .NET Core Attach Process and search for `func host start` process and attach to it.
4. Add a breakpoint in both editors and continue debugging.

## Testing changes locally (Windows)

Follow all the steps above, use the Azure Storage Emulator for windows to simulate the storage account, and optionally use Visual Studio to debug the .NET Durable Extension.

## Getting help

 - Leave comments on your PR and @username for attention