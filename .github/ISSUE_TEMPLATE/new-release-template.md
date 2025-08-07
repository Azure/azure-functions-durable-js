---
name: New release template
about: Template for creating new releases of the Durable Functions Node.js SDK

---
**Prep Release**
- [ ] Create a post in the Durable Functions Release Teams channel to let the team know that we are starting a DF Node SDK release.
- [ ] Check that [package.json](https://github.com/Azure/azure-functions-durable-js/blob/v3.x/package.json) has the correct package version.
- [ ] The [official pipeline](https://dev.azure.com/azfunc/internal/_build?definitionId=546) should automatically run after a PR is merged to v3.x so you don't have to run it manually. Check that the pipeline ran with the expected latest PR. Download the .tgz package from the drop folder.
- [ ] Draft the release notes.

**Testing**
- To test the package from the official pipeline, run the following commands from your test app
1. Uninstall the current durable-functions package: `npm uninstall durable-functions`
2. Clear all npm cache (optional): `npm cache clean --force` 
3. Install your local .tgz file: `npm install <path to .tgz>`
4. Verify the installation: `npm list durable-functions`

- [ ] Test that a JavaScript Durable Functions app works with the .tgz that we created above. Run `func host start` and trigger an orchestration.
- [ ] Test that a TypeScript Durable Functions app works with the .tgz that we created above. Run `func host start` and trigger an orchestration.

**SDK Release**
- [ ] Dry run (optional): Run the [release pipeline](https://dev.azure.com/azfunc/internal/_build?definitionId=848) with the "Dry Run" box checked so you can simulate the npm publish step. It won't actually publish, but it will let you know what version would have been published and list other metadata. Check that there are no errors or warnings in the npm publish step.
- [ ] Run the [release pipeline](https://dev.azure.com/azfunc/internal/_build?definitionId=848) from the v3.x branch without the "Dry Run" box checked. This should publish the durable-functions package to npm. If there is an error, check that the npm token hasn't expired. Currently, it's set to expire on 8/6/2026.

**Release Completion**
- [ ] Download the .tgz from the [durable-functions npm page](https://www.npmjs.com/package/durable-functions) by running `npm i durable-functions` from your test app. It should install the latest package with the new version. Test it in JS and TS apps and check that `func host start` and triggering an orchestration work.
- [ ] Publish the release notes.
