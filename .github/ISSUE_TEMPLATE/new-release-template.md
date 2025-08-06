---
name: New release template
about: Template for creating new releases of the Durable Functions Node.js SDK

---
**Prep Release**
- [ ] Check that package.json has the correct package version.
- [ ] The [official pipeline](https://dev.azure.com/azfunc/internal/_build?definitionId=546) should run after a PR is merged to v3.x. Check that the pipeline ran with the correct PRs.
- [ ] Dry run: Run the [release pipeline](https://dev.azure.com/azfunc/internal/_build?definitionId=848) with the "Dry Run" box checked so we can test the .tgz that will be released.
- [ ] Draft the release notes

**Testing**
- To test the package from the release pipeline, run the following commands from your test app
1. Uninstall the current durable-functions package: `npm uninstall durable-functions`
2. Install your local .tgz file: `npm install <path to .tgz>`
3. Verify the installation: `npm list durable-functions`

- [ ] Test that a JavaScript Durable Functions app works with the .tgz that we created above. Run `func host start` and trigger an orchestration.
- [ ] Test that a TypeScript Durable Functions app works with the .tgz that we created above. Run `func host start` and trigger an orchestration.

**SDK Release**
- [ ] Run the [release pipeline](https://dev.azure.com/azfunc/internal/_build?definitionId=848) from the v3.x branch without the "Dry Run" box checked. This should publish the durable-functions package to npm.

**Release Completion**
- [ ] Publish release notes.
