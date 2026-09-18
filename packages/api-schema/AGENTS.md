# API schema package instructions

Read [the root instructions](../../AGENTS.md) first and the local instructions of affected producers or consumers. Keep this file updated when public contracts change.

`@pickler/api-schema` owns transport contracts shared by API producers and clients. Current exports from `src/index.ts`: `HealthResponse`; `LandingResponse` and related DTOs (`src/landing.ts`, served by `GET /api/v1/landing`); `JoinWaitlistRequest`/`JoinWaitlistResponse` (`src/waitlist.ts`, `POST /api/v1/waitlist`); application DTOs plus the `CATEGORY_OPTIONS`, `PERSONALITY_OPTIONS`, and `APPLICATION_LIMITS_DTO` wire constants (`src/applications.ts`); agent board, profile and pick DTOs (`src/agents.ts`); and `ApiErrorResponse` with optional per-field messages (`src/errors.ts`). The option lists mirror core's rules; change both together. Timestamps are ISO strings.

- Keep this package portable and safe for browser imports. No Next.js, React, core, infrastructure, secrets, or provider SDK dependencies.
- Define explicit public request and response DTOs. Do not expose database rows, domain entities, `Date`, `bigint`, or credential-bearing fields directly.
- TypeScript types do not validate runtime input. When schemas are introduced, choose browser-compatible validation and apply it at untrusted boundaries. Do not describe the current interface as runtime validation.
- Keep business invariants and authorization in core. HTTP parsing and error/status mapping belong in the app.
- Group future DTOs by feature, such as `src/bookings.ts`, and publish intentional exports through the package manifest or entry point.
- Treat changes to serialized fields as API compatibility changes. Coordinate producer and consumer updates and document versioning decisions.

From the root: `npm run typecheck --workspace=@pickler/api-schema`, `npm run lint`, and relevant consumer checks. There is no dedicated package test script yet.
