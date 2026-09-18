# Infrastructure package instructions

Read [the root instructions](../../AGENTS.md) and [core instructions](../core/AGENTS.md) before changing adapters or their ports. Read any other affected project's local instructions and keep this file current.

## Responsibility and current state

`@pickler/infrastructure` implements interfaces owned by core. Exports from `src/index.ts`:

| Export | Implements | Notes |
| --- | --- | --- |
| `systemClock` | `Clock` | |
| `encryptAes256Gcm`, `decryptAes256Gcm`, legacy decrypt helpers | — | Ported from Relayer; byte-compatible with values Relayer stored. Workers-safe (`@noble/hashes` + WebCrypto). |
| `createSupabaseJwtVerifier(config)` | `AccessTokenVerifier` | Local ES256 verification against the Supabase JWKS with pinned issuer and audience. |
| `createSupabaseAdmin(config)` | — | supabase-js admin client factory (no module-level singleton). |
| `createSupabaseWorkspaceDirectory(db)` | `WorkspaceDirectory` | Reads `identity.workspaces` and `identity.workspace_members`; the owner is `admin`. |
| `createSupabaseApiKeyDirectory(db)` | `ApiKeyDirectory` | Reads `identity.api_keys`; a revoked key is inactive. |
| `createSupabaseAgentRegistry(db)` | `AgentRegistry` | Reads `agents.agents` + `agent_profiles` with explicit columns; only `findCredentials` embeds `agent_credentials`. |
| `createTurnkeyReader(config)` | `TurnkeyReader` | Parent API key, read-only (`get_activity`). Requests are stamped by `@turnkey/http` + `ApiKeyStamper` pinned to WebCrypto and sent with our own fetch, because `TurnkeyClient` uses `redirect: "error"`, which Workers rejects. |
| `createTurnkeyActivityForwarder(config)` | `SignedActivityForwarder` | Forwards passkey-stamped activities: Turnkey origin, `/public/v1/submit/*` only, allow-listed activity types, body must target the caller's sub-org; short polling to a terminal status. |
| `createSupabaseProfileRepository(db)` | `ProfileRepository` | `identity.profiles` through `identity.create_profile` and `identity.handle_available` (handles are shared with agents and released handles cool down for 30 days). Requires the `identity` schema exposed in the Data API. |
| `createSupabaseBudgetSource(db)` | `BudgetSource` | Reads `budget.budgets` (category, `limit_micro_usd`, `spent_micro_usd`) for ledger hydration. |
| `createSupabaseAgentEventLog(db)` | `AgentEventLog` | Reads `agents.agent_events` (analytics scan capped at `ANALYTICS_ROW_LIMIT`, filtered and paginated audit). |
| `createSampleLandingReadModel(clock)` | `LandingReadModel` | Sample content from the landing design, marked `source: "sample"`. Not live data. |
| `createInMemoryApplicantStore(options)` | `WaitlistRepository`, `ApplicantRepository` | Process memory only; for sample mode and local development. |
| `SAMPLE_AGENT_TICKERS` | — | Tickers of the sample agents, reserved in sample mode. |
| `createSampleAgentDirectory(clock)` | `AgentDirectory` | Sample board, profiles and picks from the "Pickler Public" design; wallets and hashes are placeholders. |
| `createSupabaseRestClient(config)` | — | PostgREST RPC over `fetch` with timeout and normalized errors; `schema` selects the Postgres schema (`Content-Profile`). Portable to Cloudflare Workers. |
| `createSupabaseWaitlist(client)` | `WaitlistRepository` | Calls `growth.join_waitlist(p_email, p_referral_code)` (client built with `schema: "growth"`); not retried automatically. |
| `createSupabaseApplicants(client)` | `ApplicantRepository` | Calls `growth.applicant_by_token`, `submit_application`, `ticker_available`; malformed tokens never reach Postgres. |

The SQL contract lives in `supabase/migrations`. When changing `growth.applicant_by_token()`, update the zod schema and regenerate `test/fixtures/applicant.json` from the real function output. Landing and agent board data stay on the sample adapters until the `market` schema exists. Organize further adapters by feature, e.g. `src/blockchain/<capability>.ts`.

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

From the root: `npm run typecheck --workspace=@pickler/infrastructure` and `npm run lint`. `npm test` runs `test/*.test.ts`, including Supabase adapter contract tests for success, HTTP and network failures, timeouts, and contract violations. They use injected `fetch` and never contact Supabase. Use `npm run build` when changing exports consumed by Next.js.
