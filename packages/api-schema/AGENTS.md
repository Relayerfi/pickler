# API schema package instructions

Read [the root instructions](../../AGENTS.md) first and the local instructions of affected producers or consumers. Keep this file updated when public contracts change.

`@pickler/api-schema` owns transport contracts shared by API producers and clients. The current export is `HealthResponse` in `src/index.ts`: `status: "ok"` and an ISO timestamp string `checkedAt`.

- Keep this package portable and safe for browser imports. No Next.js, React, core, infrastructure, secrets, or provider SDK dependencies.
- Define explicit public request and response DTOs. Do not expose database rows, domain entities, `Date`, `bigint`, or credential-bearing fields directly.
- TypeScript types do not validate runtime input. When schemas are introduced, choose browser-compatible validation and apply it at untrusted boundaries. Do not describe the current interface as runtime validation.
- Keep business invariants and authorization in core. HTTP parsing and error/status mapping belong in the app.
- Group future DTOs by feature, such as `src/bookings.ts`, and publish intentional exports through the package manifest or entry point.
- Treat changes to serialized fields as API compatibility changes. Coordinate producer and consumer updates and document versioning decisions.

From the root: `npm run typecheck --workspace=@pickler/api-schema`, `npm run lint`, and relevant consumer checks. There is no dedicated package test script yet.
