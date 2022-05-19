## Smoke Test App

This app is used to smoke test the packed `durable-functions` module, during the CI/CD pipeline.

The purpose of this test is to detect certain kind of errors, which unit tests alone may not cover.

For example, one such error is if we accidentally introduce a dependency on an external module's types. See the [#353](https://github.com/Azure/azure-functions-durable-js/issues/353) and [#355](https://github.com/Azure/azure-functions-durable-js/pull/355) for more details and an example.

To detect these errors, during the build pipeline, the repro steps specified in [#353](https://github.com/Azure/azure-functions-durable-js/issues/353) are replicated. The `durable-functions` module is packed, then this `test-app` directory is copied into a different `test-app` directory, which is _in a different root directory than the root `durable-functions` module_. Then, `npm install` and `npm run build` are run in the new `test-app` directory. See [#355](https://github.com/Azure/azure-functions-durable-js/pull/355) for more details.
