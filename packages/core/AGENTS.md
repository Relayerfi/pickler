# Core package instructions

Read [the root instructions](../../AGENTS.md) first. Read the local instructions of any other project you inspect or change. Keep this file aligned with actual business modules, exports, and tests.

## Responsibility

`@pickler/core` owns the business layer: domain entities and invariants, application use cases, authorization rules, and ports for external capabilities. It must remain usable without Next.js or any specific provider.

Current source includes `application/get-health.ts`, `ports/clock.ts` and `features/research/{types,policy,run-research}.ts`. Public exports include research capability/repository ports, entities, configuration and schedule policy, decimal price comparison and `createResearchRunner`.

The runner owns permission rechecks, evidence attribution, bounded capability use and final quote verification. It accepts trusted scope from persisted jobs. API, Studio and scheduling share the same queue/runner. Core never accepts a model-supplied tenant or grants permissions from external content. Research failures and valid abstentions remain separate states.

## Rules

- No Next.js, React, HTTP request/response objects, ORM clients, provider SDKs, environment reads, or concrete infrastructure imports.
- Use plain input values and verified actor data. Enforce business authorization here, not only in UI or transport code.
- Define capability-specific ports here and inject implementations into use-case factories. Do not import infrastructure to construct a dependency.
- Domain models are not HTTP DTOs. Core may use `Date` or `bigint` internally; presentation maps them to public wire formats.
- Use typed business failures without HTTP status codes. Infrastructure should translate technical failures into errors the use case can understand.
- Keep public exports intentional in `src/index.ts`; use relative imports inside the package. Current lint rules prohibit dependencies on sibling runtime packages and agent SDKs from core. Relative imports use `.js` extensions for compiled Node ESM. `npm run build --workspace=@pickler/core` emits `dist`; public types resolve to source, runtime imports to compiled output.
- Do not add business rules that have not been specified by the product requirements.

## Checks

From root, run `npm test`, `npm run typecheck` and `npm run lint`. Root tests build shared packages first and include runner integration tests under infrastructure, which inject providers and use temporary SQLite files. Core health tests remain in `test`. Add framework-independent unit tests here for standalone domain policy. Do not move persistence implementations into core.
