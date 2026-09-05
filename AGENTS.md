# AGENTS.md

## Project

`computer-room` is a personal virtual computer homepage hosted on Cloudflare Workers. The owner's workspace is private; selected items can be published for read-only guest access.

* React provides the UI.
* Cloudflare Access protects owner access; guest APIs enforce publication rules in the Worker.
* D1 stores structured data and widget layouts.
* R2 stores private files.

Preserve the Windows XP Luna desktop and early Android mobile styles unless the user requests a different visual direction. Keep interactions functional and minimal within those styles.

Use [documents/INDEX.md](documents/INDEX.md) to find feature, development, and operational documentation relevant to the task.

## Architecture

Preserve the existing separation between client, domain, application, infrastructure, HTTP, constants, and types.

* Keep domain logic pure and independent of React, Cloudflare, D1, R2, and HTTP.
* Application code should depend on abstractions, not infrastructure implementations.
* Keep React-specific code in the client and Cloudflare-specific code in server adapters, infrastructure, HTTP, or composition roots. Keep D1 and R2 implementation details in infrastructure.
* Organize layers with multiple responsibilities by feature, following the existing feature directories.
* Separate desktop and mobile implementations explicitly under `client/components` and `client/styles`; keep hooks, state, API, domain, constants, and types shared by feature unless behavior is genuinely interface-specific.
* Use `@/*`, `@client/*`, and `@test/*` aliases and import the owning module directly; do not add barrel `index.ts` files.
* Keep TypeScript aliases in `tsconfig.base.json`; keep the nested client `tsconfig.json` files as thin VS Code project entry points.
* Mirror source features under `test` and place reusable fakes in `test/support/<feature>`.

## Change Discipline

* Prefer the smallest maintainable change that fully satisfies the request.
* Follow the existing structure, naming, imports, and TypeScript patterns. Reuse and extend existing types, utilities, and implementations; improve a local pattern when extending it would clearly increase duplication or maintenance cost.
* Do not refactor, rename, move, or reorganize unrelated code.
* Remove obsolete code when replacing an existing implementation.

## Extensibility

* Consider a lookup map or configuration table for simple behavior selected by a known key when it makes extensions clearer. Keep straightforward conditionals and complex business rules as readable branches.
* Introduce abstractions only for a clear current responsibility; do not add them solely for hypothetical future extensions.

## Contracts and Data

Treat API contracts, database schemas, storage conventions, and shared constants as stable contracts.

* Validate untrusted input at system boundaries.
* Build dynamic API route patterns with the shared HTTP route helpers. Reuse `API_PATHS` and `API_ROUTE_PATTERN`; do not inline `/api/...`, `([^/]+)`, or exact-route anchors in route handlers.
* Use explicit migrations for database schema changes.
* Treat applied migration files as immutable; add a new migration instead of editing or removing one.
* Do not rely on `PRAGMA foreign_keys=OFF` to preserve D1 child rows during a referenced-table rebuild.
* Explicitly preserve dependent rows and add migration regression coverage before rebuilding a referenced table.
* Avoid breaking existing contracts unless the requested change requires it.
* Use `프로그램` in user-facing Korean copy and `Application` for new UI/catalog concepts; preserve existing `widget` database, API, filesystem-kind, and legacy symbol names as compatibility contracts.

## Constants

* Keep shared contracts, policy values, and configuration in responsibility-specific `constants` modules, with a single source of truth for API paths, headers, status values, error codes, and limits. Do not create catch-all constant files.
* Use `UPPER_SNAKE_CASE` for standalone constants and `as const` for immutable constant maps.
* Simple implementation values used by only one file may remain near their usage; do not extract every literal into a constants module.
* Put static Korean UI copy in feature-specific modules under `src/client/content/ko`; client constants must not import the content layer.
* Keep server API errors, operational log messages, database seed names, and other stable server contracts in their existing contract or constant modules.

## Errors

* Do not silently swallow errors.
* Reuse existing error types, codes, and messages when available.
* Translate implementation-specific errors at architectural boundaries.
* Do not leak D1, R2, Cloudflare, stack trace, or other infrastructure details through HTTP responses.

## Security

* Do not log secrets, authentication data, private file contents, or sensitive values.
* Keep secrets and environment-specific credentials out of source code.
* Do not weaken Cloudflare Access or private R2 protections for development convenience.
* Preserve owner API authentication and same-origin checks on writes. Guest access must remain read-only and enforce the master setting and publication rules on each request; see [documents/GUEST_ACCESS.md](documents/GUEST_ACCESS.md).
* Do not expose private R2 objects publicly unless explicitly required.

## Testing and Validation

* Test changed observable behavior when appropriate and add regression coverage for bug fixes when practical. Avoid tests that merely mirror the implementation.
* Keep domain tests independent of React, Cloudflare, D1, R2, and HTTP.
* Run pure server tests and client `*.unit.test.ts` files in Node; reserve jsdom for UI and Workers for real binding integration.
* Keep test data fixtures independent of React rendering helpers. Test shared behavior in focused tests and keep application-level scenarios focused on integration wiring.
* UI tests fail on unexpected `console.error`; explicitly intercept and assert errors that a failure scenario is meant to produce.
* Do not remove or weaken existing tests merely to make a change pass.
* For code or configuration changes, run `npm run check` and relevant tests using `test:unit`, `test:client`, or `test:worker`. Run `npm run build` when changes affect the build or client bundle. Use [package.json](package.json) as the source of truth for commands.
* Run `git diff --check` for changed files. Documentation-only changes need content and diff review, not application tests or builds.
* Once required checks pass, repeat or broaden validation only for new changes, failures, or unresolved concerns.
* For schema changes, run `npm run check:migrations` and relevant migration regression tests.
* Keep structure and bundle checks passing. Structure thresholds and file-size review exceptions are defined in [scripts/constants/source-structure-policy.mjs](scripts/constants/source-structure-policy.mjs); oversized files require a concrete responsibility review reason in its allowlist.
* Update documentation when behavior, configuration, schemas, or public contracts change.

## Releases

* Use the guarded `npm run deploy` pipeline by default. Use `npm run deploy:worker` only after separately running the required checks and verifying that the remote DB already has the required schema, as described in [documents/DEPLOYMENT.md](documents/DEPLOYMENT.md).

## Completion Report

* Explain what changed and why, including user-visible effects and relevant architectural or contract implications. Scale detail to the change.
* Report validation performed and any remaining limitations or assumptions; distinguish checks that passed from checks that were not run.
