# GitHub Copilot Instructions

This repository contains the `durable-functions` npm package — a TypeScript/JavaScript SDK for writing [Durable Functions](https://docs.microsoft.com/azure/azure-functions/durable/durable-functions-overview) on Azure Functions with Node.js 18+.

## Overview

The SDK exposes three top-level namespaces consumed by application code:

- **`df.app`** — registers orchestration, activity, entity, and client-trigger functions (`src/app.ts`, `src/client.ts`)
- **`df.trigger`** / **`df.input`** — binding helpers (`src/trigger.ts`, `src/input.ts`)
- Core classes: `RetryOptions`, `EntityId`, `DurableOrchestrationContext`, `DurableClient`, etc. (`src/`)

When contributing, keep changes consistent with the patterns in `src/` and the samples in `samples-ts/` and `samples-js/`.

---

## TypeScript Conventions

These rules are derived from the existing source in `src/`.

### Types and declarations

- **Never use `var`.** Prefer `const` for values that are not reassigned, `let` otherwise.
- **Always annotate explicit types** — do not rely on inference alone for public API surfaces. Evidence: `const output: string[] = []`, `const result: RegisteredOrchestration = ...`, `public backoffCoefficient: number` (`src/orchestrations/DurableOrchestrationContext.ts`, `src/app.ts`, `src/RetryOptions.ts`).
- **Use `unknown` instead of `any`** for untyped inputs at API boundaries. Evidence: `input: unknown`, `private input: unknown` throughout `src/orchestrations/DurableOrchestrationContext.ts` and `src/app.ts`.
- **No `noImplicitAny` violations** — `tsconfig.json` enforces `"noImplicitAny": true`.
- **Enable `strictNullChecks`** — `tsconfig.json` enforces `"strictNullChecks": true`. Guard against `null`/`undefined` explicitly (e.g., `Utils.ensureNonNull`, conditional checks in `Utils.ts`).

### Classes

- All **public static utility methods** live in a dedicated class (e.g., `Utils`, `GuidManager`). Mark internal utilities with `/** @hidden */`.
- **Validate constructor arguments eagerly** using guard methods (`Utils.throwIfNotNumber`, `Utils.throwIfEmpty`, `Utils.throwIfNotInstanceOf`) rather than deferring validation. Evidence: `RetryOptions` constructor in `src/RetryOptions.ts`.
- Implement types from the `durable-functions` public type declarations (`types/`) when a class is part of the public API. Evidence: `RetryOptions implements types.RetryOptions`, `DurableOrchestrationContext implements types.DurableOrchestrationContext`.

### Async / generators

- **Orchestrator handlers are generator functions** (`function*`) — do not use `async`/`await` inside them. Yield `Task` objects returned by `context.df.*` methods. Evidence: every sample in `samples-ts/functions/`.
- **Activity and client handlers use `async`/`await`** with explicit `Promise<T>` return types where the type is non-obvious.
- Add the `Async` suffix to the name of async utility methods where it aids clarity (consistent with standard Node.js convention and the reference repo pattern).

### Imports

- Import the public package as `import * as df from "durable-functions"` in sample/test code.
- In library source (`src/`), import named types directly from `"durable-functions"` (the `types/` alias) and use the `* as types` alias for the type namespace when needed. Evidence: `import * as types from "durable-functions"` in `src/RetryOptions.ts`, `src/orchestrations/DurableOrchestrationContext.ts`.
- Group imports: external packages first, then internal modules (relative paths).

### Naming

- **camelCase** for variables, functions, and method names.
- **PascalCase** for classes, interfaces, enums, and type aliases.
- **SCREAMING_SNAKE_CASE** for environment variable names in sample/configuration code.
- Function registration names (e.g., `"helloSequence"`, `"sayHello"`) use **camelCase** strings. Evidence: `samples-ts/functions/sayHello.ts`.

### No breaking changes

- Do not remove or rename exported members, change public method signatures, or alter the shape of objects returned by public APIs without a documented exception in the PR. Breaking change reference: <https://github.com/dotnet/runtime/blob/main/docs/coding-guidelines/breaking-change-rules.md>

---

## Function Registration Patterns

Use the `df.app.*` registration helpers — do **not** use the raw Azure Functions `app.*` APIs directly in application code.

```typescript
// Orchestrator — generator function, explicit handler type
import * as df from "durable-functions";
import { OrchestrationContext, OrchestrationHandler } from "durable-functions";

const myOrchestration: OrchestrationHandler = function* (context: OrchestrationContext) {
    const result: string = yield context.df.callActivity("myActivity", "input");
    return result;
};
df.app.orchestration("myOrchestration", myOrchestration);

// Activity — synchronous or async, explicit return type
df.app.activity("myActivity", {
    handler: function (input: unknown): string {
        return `Hello ${input}`;
    },
});

// Client-trigger function (HTTP example)
df.app.client.http("httpStart", {
    route: "orchestrators/{functionName}",
    handler: async function (request, client, context) { /* ... */ },
});
```

---

## Testing (Mocha + Chai)

Unit tests live in `test/unit/` and use the **Mocha** test runner with **Chai** assertions. Integration tests live in `test/integration/`.

### Test file naming

- Test files must end in `-spec.ts` (compiled to `-spec.js`). Evidence: `test/unit/retryoptions-spec.ts`, `test/unit/utils-spec.ts`.
- The compiled output is run via `mocha --recursive ./lib/test/**/*-spec.js` (see `package.json` `"test"` script).

### Test structure

- Organize tests with `describe` blocks that mirror the class or module name, then nested `describe` blocks for each method under test.
- Name `it` blocks so they read as a sentence starting with what the subject does, e.g., `"throws if firstRetryIntervalInMilliseconds less than or equal to zero"`.
- Use `expect` from Chai — **not** `assert` or `should`. Evidence: `test/unit/utils-spec.ts`, `test/unit/retryoptions-spec.ts`.

```typescript
import { expect } from "chai";
import "mocha";
import { RetryOptions } from "../../src/RetryOptions";

describe("RetryOptions", () => {
    it("throws if firstRetryIntervalInMilliseconds is zero", () => {
        expect(() => new RetryOptions(0, 1)).to.throw(
            "firstRetryIntervalInMilliseconds value must be greater than 0."
        );
    });
});
```

- **Avoid mocking the class under test.** Only mock external dependencies (HTTP, Azure Storage, etc.). Evidence: tests in `test/unit/` test real implementations directly.
- **Sinon** is available for spies/stubs (`sinon` in `devDependencies`); use it when you need to verify side effects.
- **chai-as-promised** is available for asserting on rejected/resolved promises.
- Keep tests focused: one assertion per `it` block is preferred; add a second only when both assertions test the same behaviour atomically.

---

## Build & Package

### Scripts (from `package.json`)

| Command | Purpose |
|---|---|
| `npm run build` | Full build: install → clean → lint → compile → strip internal docs |
| `npm run lint` | ESLint over `src/` (TypeScript + JSON) |
| `npm run lint:test` | ESLint over `test/` |
| `npm test` | Full build then run Mocha test suite |
| `npm run test:nolint` | Build without lint, then run tests (faster local iteration) |
| `npm run watch` | `tsc --watch` for incremental compilation |
| `npm run build:samples` | Build `samples/` separately |

- **Always run `npm test`** (or at minimum `npm run build` + `npm run test:nolint`) before opening a PR.
- **Do not skip linting** (`npm run lint`) — ESLint with `@typescript-eslint` and `prettier` is enforced in CI.
- The compiled output goes to `lib/`; the published package ships only `lib/src/` and `types/` (see `"files"` in `package.json`).

### TypeScript compiler options (enforced by `tsconfig.json`)

- `"noImplicitAny": true` — explicit types required.
- `"strictNullChecks": true` — null/undefined must be handled explicitly.
- `"target": "es6"`, `"module": "commonjs"` — compile to ES6 CommonJS for Node.js compatibility.
- `"strictBindCallApply": true` — bind/call/apply type-checked.

### Versioning & package

- The package is published to npm as `durable-functions` (current version in `package.json`).
- Do not add new runtime `dependencies` without discussion — the dependency surface is intentionally narrow.

---

## Sample Code Guidelines

Samples live in `samples-ts/` (TypeScript) and `samples-js/` (JavaScript). Each sample directory contains `functions/`, `host.json`, `package.json`, and `tsconfig.json`.

- **Read configuration from environment variables**, not hardcoded values. Use `process.env.MY_VAR ?? throwIfMissing("MY_VAR")` or equivalent. Environment variable names use `UPPER_SNAKE_CASE`. Evidence: pattern from the reference style guide; secrets must never be committed.
- **No hardcoded secrets, connection strings, or storage keys** in sample code or anywhere in the repository.
- **Prefer explicit type annotations** over relying solely on inference, to help readers understand the SDK types. Evidence: `const output: string[] = []`, `const helloActivity: ActivityHandler = ...` in `samples-ts/functions/sayHello.ts`.
- **Use the `df.app.*` registration API** (v4 programming model). Do not use the legacy v3 binding JSON format in new samples.
- Each sample file should: (1) have imports at the top, (2) define handler variables with explicit types, (3) register functions using `df.app.*` at the bottom.
- Add a `README.md` to any new sample subdirectory explaining what it demonstrates and how to run it, matching the format of existing sample READMEs.
- Test that new samples build successfully via `npm run validate:samples`.

---

## Code Review Guidelines

When reviewing code in this repository:

- **Provide all review comments in a single pass.** Do not scatter feedback across multiple partial reviews; consolidate findings into one coherent round.
- **Do not surface already-resolved or stale comments.** Only flag issues that still apply after the latest commit.
- **Respect author explanations.** If a contributor has responded to a comment with a clear justification, do not re-post the same comment.
- **Check for breaking changes.** Any removal or rename of a public export, change to a public method signature, or alteration of a returned object's shape must be explicitly justified in the PR description.
- **Verify test coverage.** New behaviour must be accompanied by a test in `test/unit/` or `test/integration/`. Existing tests must not be deleted without replacement.
- **Confirm lint and build pass.** Do not approve a PR if `npm run build` or `npm test` fails.
