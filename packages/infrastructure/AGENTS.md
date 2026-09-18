# Infrastructure package instructions

Read [the root instructions](../../AGENTS.md) and [core instructions](../core/AGENTS.md) before changing adapters or their ports. Read any other affected project's local instructions and keep this file current.

## Responsibility and current state

`@pickler/infrastructure` implements interfaces owned by core. It exports `systemClock`, `ExaResearch` (`WebSearch`/`PageReader`), `PolymarketData` (`MarketData`) and `PostgresResearchStore` (scoped configuration, runs, evidence, decisions and job persistence). Constructors accept configuration; no credentials are embedded.

It also carries the adapters ported from Relayer for the public product: AES-256-GCM crypto byte-compatible with stored values, the Supabase JWT verifier (`jose`), Supabase admin adapters for workspaces, API keys, agents, budgets and profiles, the PostgREST client used by the growth functions, and Turnkey stamping and activity forwarding. `createSampleAgentDirectory`, `createSampleLandingReadModel` and `createInMemoryApplicantStore` serve labelled sample content for the public pages until an indexer exists. These adapters read the product schemas defined in `src/persistence/product/`; see [supabase/AGENTS.md](../../supabase/AGENTS.md) for the hosted project.

Actual adapters live in `src/research`, `src/polymarket` and `src/persistence`. Business policy comes from core; SQL implements transactional admission, idempotency, claims and scoped access. Drizzle defines the research tables in `src/persistence/schema.ts`, the product schemas (`identity`, `agents`, `budget`, `audit`, `growth`, `market`) in `src/persistence/product/`, and versioned SQL migrations in `drizzle/`. `0002_product_functions_and_grants.sql` is a custom migration holding what Drizzle cannot express: the `internal` helper schema, triggers, deferrable foreign keys, the `auth.users` references, the security-definer functions and the grants. It skips the Supabase-only parts when those roles or tables are absent, so it also runs on the Docker PostgreSQL. Admission, configuration, claims and scheduling lock agent rows in transactions. Never retry ambiguous research automatically. New providers must pass capability contract tests. Public runtime exports use compiled `dist`; relative source imports include `.js` extensions.

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

Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` from root. Tests in `test/*.test.ts` cover provider normalization/errors, PostgreSQL isolation/concurrency/recovery/schedules, and core research with injected providers. No paid calls occur in tests. Shared package builds precede runtime consumption. Use the private `pickler` schema; Mastra owns the separate `mastra` schema in the same PostgreSQL database. `@pickler/infrastructure/testing` is a test-only helper that creates and removes isolated databases; never import it from runtime code. Run `npm run db:up` before integration tests. Generate schema migrations with `npm run db:generate` and apply them explicitly with `npm run db:migrate`; startup must not migrate Pickler tables.

Decision v2 and uncertainty-policy settings use the existing JSONB columns; no database migration or historical backfill is required. Preserve old decision/config documents on reads. Policy updates use the existing versioned config transaction and disable scheduling. Integration tests verify proposal/final-verdict persistence, policy version snapshots and tenant isolation.

Provider HTTP calls use `redirect: "manual"` and reject all non-success responses, including redirects. This preserves credential isolation and works in both Node.js and Cloudflare Workers, which does not support the `error` redirect mode.
