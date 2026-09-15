# Infrastructure package instructions

Read [the root instructions](../../AGENTS.md) and [core instructions](../core/AGENTS.md) before changing adapters or their ports. Read any other affected project's local instructions and keep this file current.

## Responsibility and current state

`@pickler/infrastructure` implements interfaces owned by core. Its only current implementation is `systemClock`, exported from `src/index.ts` and implementing core's `Clock` port. No database, provider SDK, RPC client, or credentials are configured.

As concrete capabilities are introduced, organize adapters by feature, for example `src/bookings/booking-repository.ts` or `src/blockchain/<capability>.ts`. These are proposed paths, not existing integrations.

## Rules

- Depend on `@pickler/core` ports; never make core depend on this package.
- Keep provider SDK types, queries, protocol details, and technical response validation inside adapters. Return values matching business-owned interfaces.
- No Next.js, React, web app imports, HTTP response construction, or UI behavior.
- Accept validated configuration through constructors/factories. The application's protected composition root selects and instantiates adapters. Do not require Next.js-specific `server-only` inside this framework-independent package.
- Keep credentials out of public exports and logs. Consumers must protect server imports; do not expose this package through client barrels.
- Configure timeouts and normalize failures. Retry only safe or idempotent operations. Do not automatically retry ambiguous writes or transaction submissions.
- Verify provider webhook signatures at the appropriate integration boundary and support deduplication when such flows are introduced. Keep HTTP mapping in the app.
- Blockchain adapters may use public artifacts from `chain` after declaring that dependency. Business code must remain independent of the chosen blockchain SDK.
- Do not add placeholder adapters to claim that a provider is integrated.

## Checks

From the root: `npm run typecheck --workspace=@pickler/infrastructure` and `npm run lint`. Add adapter contract tests when real integrations exist, covering failures and timeouts as well as success. There is no infrastructure test script yet; explicitly wire new tests into the root checks. Use `npm run build` when changing exports consumed by Next.js.

## Planned agent pilot

The planned [agent runtime V1](../../docs/specs/agent-runtime-v1.md) places Exa, Polymarket, persistence, queue, and credential adapters here, with Firecrawl as a later option. No such adapters are implemented yet. Mastra-specific tool wrappers belong to the new agent-service host and call use cases. Provider replacement must preserve capability contracts and record provenance.
