# API schema package instructions

Read [the root instructions](../../AGENTS.md) first and the local instructions of affected producers or consumers. Keep this file updated when public contracts change.

`@pickler/api-schema` owns transport contracts shared by API producers and clients. Exports include `HealthResponse` and the Zod research schemas in `src/research.ts`: configuration/limits, updates, dispatch, pause, scheduling, agent/run/event responses and decisions. Public runtime imports use compiled `dist`; types resolve to source.

- Keep this package portable and safe for browser imports. No Next.js, React, core, infrastructure, secrets, or provider SDK dependencies.
- Define explicit public request and response DTOs. Do not expose database rows, domain entities, `Date`, `bigint`, or credential-bearing fields directly.
- TypeScript types do not validate runtime input. When schemas are introduced, choose browser-compatible validation and apply it at untrusted boundaries. Apply the exported Zod schemas to requests, responses and structured decisions; health remains a TypeScript-only interface.
- Keep business invariants and authorization in core. HTTP parsing and error/status mapping belong in the app.
- Group future DTOs by feature, such as `src/bookings.ts`, and publish intentional exports through the package manifest or entry point.
- Treat changes to serialized fields as API compatibility changes. Coordinate producer and consumer updates and document versioning decisions.

From the root: `npm run typecheck --workspace=@pickler/api-schema`, `npm run lint`, and relevant consumer checks. There is no dedicated package test script yet.

## Research pilot

The local service consumes these schemas at the HTTP and model boundaries. Reject extra request fields, including caller-supplied tenant IDs. Financial prices are bounded decimal strings representing a fraction of one outcome payout per share. No executable sizes or order DTOs exist. Job timestamps use Unix milliseconds; evidence/decision timestamps use ISO UTC. Runtime schemas must stay portable and contain no business-owned imports.

The research `outputTokens` cap is 8,000 per model call, including provider reasoning tokens. Core defaults to this cap; existing persisted agent configurations retain their values until explicitly updated. The agent-service caps selection and connection probes separately at 2,000.
