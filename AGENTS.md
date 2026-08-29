# AGENTS.md

## Project

`computer-room` is a private, single-user widget homepage hosted on Cloudflare Workers.

* React provides the UI.
* Cloudflare Access protects the application.
* D1 stores structured data and widget layouts.
* R2 stores private files.

Keep the UI functional and minimal unless a visual direction is explicitly requested.

## Architecture

Preserve the existing separation between client, domain, application, infrastructure, HTTP, constants, and types.

* Keep domain logic pure and independent of React, Cloudflare, D1, R2, and HTTP.
* Application code should depend on abstractions, not infrastructure implementations.
* Keep framework-specific and Cloudflare-specific code inside adapters, infrastructure, HTTP, or composition roots.
* Do not bypass architectural boundaries for convenience.
* Reuse existing types, utilities, and abstractions before creating new ones.
* Organize every layer by feature (`filesystem`, `widgets`, `media`, `integrations`, `storage`, or `platform/shared`) when the layer contains multiple responsibilities.
* Separate desktop and mobile implementations explicitly under `client/components` and `client/styles`; keep hooks, state, API, domain, constants, and types shared by feature unless behavior is genuinely interface-specific.
* Use `@/*`, `@client/*`, and `@test/*` aliases and import the owning module directly; do not add barrel `index.ts` files.
* Mirror source features under `test` and place reusable fakes in `test/support/<feature>`.

## Change Discipline

* Prefer the smallest maintainable change that fully satisfies the request.
* Follow the existing directory structure, naming conventions, import style, and TypeScript patterns.
* Follow existing project patterns, but improve a local pattern when extending it would clearly increase duplication or future maintenance cost.
* Do not refactor, rename, move, or reorganize unrelated code.
* Do not introduce abstractions without a clear responsibility or current need.
* Prefer extending existing patterns over creating parallel implementations.
* Remove obsolete code when replacing an existing implementation.

## Extensibility

* Avoid repeatedly extending `if`/`else` or `switch` branches when behavior is primarily selected by a known key, type, status, or category.
* When adding another similar conditional branch, first consider whether the branching represents a mapping that should be expressed as data.
* Prefer lookup maps, configuration tables, or focused strategy abstractions when they make new cases localized and predictable.
* Prefer structures where adding a new case requires changing as few places as possible.
* Keep simple conditionals simple.
* Do not introduce mappings or abstractions when they reduce readability or when the logic depends on complex state or business rules.

## Contracts and Data

Treat API contracts, database schemas, storage conventions, and shared constants as stable contracts.

* Validate untrusted input at system boundaries.
* Reuse existing request, response, and contract types when available.
* Keep HTTP transport concerns separate from domain logic.
* Keep D1 and R2 implementation details inside infrastructure code.
* Use explicit migrations for database schema changes.
* Treat applied migration files as immutable; add a new migration instead of editing or removing one.
* Do not rely on `PRAGMA foreign_keys=OFF` to preserve D1 child rows during a referenced-table rebuild.
* Explicitly preserve dependent rows and add migration regression coverage before rebuilding a referenced table.
* Avoid breaking existing contracts unless the requested change requires it.

## Constants

* Put configurable, policy-like, or potentially changing values in responsibility-specific `constants` modules.
* Do not duplicate magic numbers or contract strings.
* Reuse a single source of truth for API paths, headers, status values, error codes, limits, and similar contracts.
* Use `UPPER_SNAKE_CASE` for standalone constants.
* Use `as const` for immutable constant maps.
* Do not create catch-all constant files.
* Truly immutable implementation details used by only one file may remain near their usage.
* Put static Korean UI copy in feature-specific modules under `src/client/content/ko`; client constants must not import the content layer.
* Keep server API errors, operational log messages, database seed names, and other stable server contracts in their existing contract or constant modules.

## Errors

* Do not silently swallow errors.
* Reuse existing error types, codes, and messages when available.
* Translate implementation-specific errors at architectural boundaries.
* Do not leak D1, R2, Cloudflare, stack trace, or other infrastructure details through HTTP responses.

## Security

* Treat client-provided input as untrusted.
* Do not log secrets, authentication data, private file contents, or sensitive values.
* Keep secrets and environment-specific credentials out of source code.
* Do not weaken Cloudflare Access or private R2 protections for development convenience.
* Do not expose private R2 objects publicly unless explicitly required.

## Testing and Validation

* Add or update tests for changed behavior when appropriate.
* Add regression tests for bug fixes when practical.
* Test observable behavior rather than implementation details.
* Keep domain tests independent of React, Cloudflare, D1, R2, and HTTP.
* Do not remove or weaken existing tests merely to make a change pass.
* Run relevant tests, type checks, and lint checks after changes.
* Run `npm run check:migrations` for schema changes and use the guarded `npm run deploy` pipeline for releases.
* Keep `npm run check:structure` passing: at most 12 direct source files per directory; oversized files require an explicit review reason.
* Keep the production client entry bundle below the limit enforced by `npm run check:bundle`.
* Update documentation when behavior, configuration, schemas, or public contracts change.

## Completion Report

- Do not end a completed task with only a list of modified files or technical details; explain the user-visible and architectural impact in plain language.
- Summarize what changed, why it changed, and any important behavior or contract implications.
- Mention relevant tests or validation that were performed.
- Call out any limitations, follow-up work, or assumptions when applicable.
- Avoid unnecessary implementation detail unless it helps the user understand the change.
