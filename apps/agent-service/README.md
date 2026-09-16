# Pickler research pilot

Local Mastra Studio and a tenant-scoped HTTP API for research-only decisions. Polymarket supplies markets, resolution rules and order books; Exa supplies web search and page content. The configured OpenAI-compatible model chooses one candidate and returns a validated `TRADE` proposal or `ABSTAIN`. There is no order submission, position size, wallet, signing tool or simulated portfolio.

## First local run

Use Node **22.22+** (Node 24 also works) and npm 10.9.3. From the repository root:

```sh
npm ci
npm run agent -- init
```

Edit `apps/agent-service/.env`. `init` generates distinct random laboratory tokens without printing them and refuses to overwrite an existing file. Supply both database URLs described below and all four provider settings:

- `MODEL_BASE_URL`: the exact OpenAI-compatible API base URL, including its version path when required.
- `MODEL_ID`: the exact model identifier accepted by that endpoint.
- `MODEL_API_KEY`: that endpoint's API key.
- `EXA_API_KEY`: your Exa key.

No default model, fallback provider or trading key is used. HTTPS is required except for a model hosted on loopback. Compatibility depends on tool calling and structured output support; the explicit connection check verifies both with your chosen model.

Configure PostgreSQL and run `npm run db:migrate` using the instructions below before starting.

```sh
npm run dev:agent
```

Open **http://127.0.0.1:4111**. This starts Studio and one worker. Use this exact address rather than `localhost`: Host and Origin checks protect the privileged operator surface. Keep the terminal and computer running for scheduled work. No paid provider calls occur merely on startup, but previously enabled schedules and pending jobs can run.

In Studio, open **Workflows**:

1. Run `lab-presets` with `{}` to inspect both agents, their current configuration versions, the first 100 Polymarket tags and the two internal plugins. Tags serve as configurable categories; a known Polymarket tag ID can also be configured directly.
2. Run `configure-agent` with the preset `alpha` or `beta`, its current `expectedVersion` and a full `config`. Copy the existing config and replace `categoryIds` with selected IDs. Empty categories grant no market access. Each edit increments the version and disables scheduling.
3. Run `check-connections` with `{"runPaidCheck":true}`. This intentionally calls the model twice, invokes a harmless tool, validates a structured decision, and checks Exa search/read and the public category API. A failed check does not choose another model.
4. Run `research` with `{"preset":"alpha","requestKey":"my-first-research"}`. Use a new request key for new work; reuse it to observe the original job. Optionally add a numeric `marketId` to research a specific market within the same permitted categories.
5. Inspect the workflow result: run ID, status, decision and persisted events including candidates, selection, rules, quotes, search queries, evidence and reported model usage. `failed` is not a research abstention. If the workflow reports `poll-via-api`, continue polling its run ID; it does not enqueue another job.

Studio is privileged **local operator access**, not a tenant login. Raw researcher agents are intentionally not registered as independently callable Studio agents: that would bypass the persistent queue and quotas. The workflow exposes the reviewed plugin catalog and recorded tool results. Both presets, the API and scheduler enter the same queue and core runner.

## PostgreSQL, Supabase and migrations

Use one PostgreSQL database with separate `pickler` and `mastra` schemas. Supabase hosts PostgreSQL; this backend connects using the PostgreSQL connection string, not the Supabase browser client, anon key, or service-role API key.

1. In your Supabase project's **Connect** panel, copy the **Direct connection** URL when your network supports it, or the **Session pooler** URL for IPv4. Use session mode on port 5432, not transaction mode on port 6543: worker ownership requires a persistent PostgreSQL session.
2. Set `DATABASE_URL` in `apps/agent-service/.env`. Keep the provider's TLS settings and enable SSL enforcement in Supabase. Never disable certificate verification. URL-encode special characters in the database password.
3. Set `DATABASE_MIGRATION_URL` to a direct or session connection with schema creation privileges. For this operator-only pilot, both URLs can use the same database owner. Runtime must own the Pickler tables (or have BYPASSRLS) because no tenant-facing SQL policies are installed. Mastra currently initializes its own schema at startup, so its connection also needs schema/table creation privileges.
4. Run `npm run db:migrate` from the repository root. This applies committed Drizzle migrations; running it again is safe. Run one migration process per deployment. Start the agent afterwards; startup seeds the two lab agents idempotently.

The database schemas are server-only. Do not add `pickler`, `pickler_migrations`, or `mastra` to Supabase's exposed Data API schemas or grant browser roles access. Pickler tables enable RLS without public policies as a default denial for non-owner roles. The privileged backend bypasses RLS and enforces tenant scope in repository queries and the API; these are not Supabase Auth policies. Public login and production role separation remain separate work.

For local development without Supabase:

```sh
npm run db:up
```

Set both database URLs to `postgresql://pickler:pickler_local_only@127.0.0.1:55432/pickler`, then run `npm run db:migrate`. These credentials are only for the loopback Docker development service. `npm run db:down` stops the container and preserves its named volume.

To change tables, edit `packages/infrastructure/src/persistence/schema.ts`, run `npm run db:generate`, review the generated SQL and commit the migration and snapshots. Apply with `npm run db:migrate`. Do not use schema push against shared databases. Mastra manages its own tables; Drizzle owns only `pickler`.

Integration tests use real PostgreSQL and create a randomly named `pickler_test_*` database per test, apply migrations, then remove only that database. They default to the local Docker connection. Set `TEST_DATABASE_URL` to override with a **dedicated test server** and a role with `CREATEDB`; never use production. No Supabase account or paid model credentials are required for these tests.

This migration starts a fresh PostgreSQL pilot. Existing ignored SQLite files are left intact; their data is not automatically imported. If a previous pilot contains valuable history, retain those files and perform a separately reviewed data import before switching environments.

References: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Drizzle with Supabase](https://orm.drizzle.team/docs/get-started/supabase-new), [Mastra PostgreSQL](https://mastra.ai/integrations/databases/postgresql).

## CLI and API

All commands below run at repository root, with the service running. CLI tokens come from the app's `.env`; do not put tokens in URLs or commit them.

```sh
npm run agent -- agents alpha
npm run agent -- categories alpha
npm run agent -- check alpha
npm run agent -- configure alpha config.json
npm run agent -- run alpha
npm run agent -- run alpha 2252242
npm run agent -- result alpha RUN_ID
npm run agent -- events alpha RUN_ID
npm run agent -- schedule alpha on
npm run agent -- schedule alpha off
npm run agent -- pause alpha
npm run agent -- resume alpha
```

The market ID above illustrates syntax, not a durable recommendation. `config.json` is resolved relative to `apps/agent-service` by the CLI. Example configuration update (replace category IDs with your selection and use the version returned by `agents`):

```json
{
  "expectedVersion": 1,
  "config": {
    "profile": "Read resolution rules and research both supporting and contrary evidence. Abstain when uncertain.",
    "categoryIds": ["2"],
    "tools": ["searchWeb", "readPage", "getMarketRules", "getOrderBook"],
    "intervalHours": 4,
    "limits": {
      "searches": 3,
      "pageReads": 5,
      "steps": 12,
      "durationMs": 300000,
      "outputTokens": 2000,
      "dailyRuns": 6
    }
  }
}
```

HTTP base: `http://127.0.0.1:4111/pilot`. Send `Authorization: Bearer <tenant-token>` on every endpoint. Tokens resolve to a fixed tenant on the server; neither JSON input nor model context can choose the API tenant.

| Method | Path                   | Behavior                                                                             |
| ------ | ---------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/categories`          | First 100 provider tags; response states the catalog limit                           |
| GET    | `/agents`              | Only the authenticated tenant's agent                                                |
| GET    | `/agents/:id`          | Configuration, version, pause and next occurrence                                    |
| PUT    | `/agents/:id/config`   | Full config and `expectedVersion`; stale writes return 409                           |
| POST   | `/agents/:id/runs`     | `{}` or `{ "marketId": "..." }`; required `Idempotency-Key` header; 202 with `runId` |
| GET    | `/runs/:id`            | Poll status, safe failure code and decision                                          |
| GET    | `/runs/:id/events`     | Persisted partial evidence and diagnostic events                                     |
| PUT    | `/agents/:id/schedule` | `{ "enabled": true }` or false                                                       |
| PUT    | `/agents/:id/pause`    | `{ "paused": true }` or false                                                        |
| POST   | `/connections/check`   | Explicit paid model/Exa diagnostics                                                  |

Use the same idempotency key to retry an ambiguous dispatch. Reusing a key with a different market returns 409. Cross-tenant resource access returns 404; missing/invalid tokens return 401. Public schemas live in `@pickler/api-schema`. Times in run/config DTOs are Unix milliseconds; evidence and decision timestamps are ISO UTC. Prices are decimal strings expressing fractions of one unit of outcome payout per share. They are proposals, not executable amounts.

## Execution and persistence

- `pickler` PostgreSQL schema: tenant configuration, queued jobs, immutable config snapshots, JSONB events and decisions, accessed through Drizzle and `pg`.
- `mastra` PostgreSQL schema: framework storage through `@mastra/pg`, initialized by Mastra. It is operator-visible, not a public tenant resource.
- A PostgreSQL session advisory lock admits one worker across machines. A second worker fails before recovery. Connection loss aborts the owner; database disconnection releases its lock. The pilot still processes research serially. Agent row locks, transactions and a partial unique index additionally enforce one running investigation per agent. Scaling to multiple workers requires per-job leases and recovery changes, not just increasing replicas.

A job ID is its run ID. Scheduled occurrence is encoded in its unique persistent request key (`schedule:CONFIG_VERSION:DUE_TIMESTAMP`), alongside the agent's persisted `nextDueAt`. Duplicate ticks cannot enqueue duplicate work. Missed intervals collapse into one current run. An existing queued/running job prevents a new periodic enqueue. Six jobs per rolling 24 hours is the default; failed/cancelled jobs also consume the conservative admission quota.

Interrupted running jobs become `failed/INTERRUPTED` on worker restart and retain their events. They are never automatically retried. Unstarted manual jobs remain pending. Pausing cancels pending jobs and prevents future tool calls in running jobs; it cannot undo a provider call already in flight. Resuming keeps the configured schedule, coalescing missed occurrences. A config edit cancels stale pending work at claim time and blocks subsequent calls from an old running version.

Scheduling starts disabled. Enabling it requires a successful connection check plus completed manual research for the agent's current config. Changing model endpoint, model ID or provider credentials invalidates readiness and disables schedules. Restarting with the same settings preserves scheduling. The default interval is four hours, configurable from one hour to seven days.

Limits can be reduced (at least two searches and three model steps) but cannot exceed the pilot caps: three searches, five page reads, twelve total model steps (one reserved for candidate selection), five minutes and 2,000 output tokens per model call; six jobs per rolling day. Market discovery returns at most 20 candidates, ranked by reported liquidity; it queries up to 20 per selected tag, deduplicates and retains the top 20. Selected market tags are independently fetched before research. Rules cannot exceed 16,000 characters; larger rules fail rather than being silently cut. Exa content is capped at 6,000 characters per source and marked when truncated. HTTP provider responses have a two-megabyte cap and 20-second timeout; individual model requests have a 60-second timeout within the overall run deadline. Reported usage is stored when available, not invented when absent. These are usage bounds, not a guaranteed monetary budget.

The runner checks permissions again before every capability call. Mandatory rules, order book and search capabilities must be enabled to begin research. Page reads are restricted to URLs discovered in that run. Provider failures cannot be converted to successful abstentions by the model. A `TRADE` proposal rechecks market eligibility and refreshes the outcome's ask; a missing/stale quote fails the run, and a fresh ask above the proposed limit yields an explained abstention. Source IDs must refer to retrieved evidence. Both a supporting and a contradicting search intent are required before a decision can complete; queries and intent are persisted for review. Research quality still needs human review; the pilot validates operation, not profitability.

## Code map and extension

```text
src/
  mastra/index.ts          # Studio workflows and loopback HTTP host
  api/app.ts               # Token resolution, request validation and HTTP mapping
  composition/container.ts # Wires core, providers, PostgreSQL and the configured model
  composition/model.ts     # Mastra implementation of ResearchModel
  config/env.ts            # Required server-only configuration
  plugins/registry.ts      # Reviewed research@1.0.0 and prediction-markets@1.0.0
  workers/main.ts          # Exclusive worker lifecycle and restart recovery
  cli.ts                   # Operator commands
../../packages/core/src/features/research/
  types.ts                 # Entities and capability/repository ports
  policy.ts                # Quotas, schedule readiness, intervals and decimal comparison
  run-research.ts          # Framework-independent research orchestration
../../packages/infrastructure/src/
  research/exa.ts          # WebSearch and PageReader
  polymarket/market-data.ts
  persistence/schema.ts       # Drizzle tables, JSONB types, constraints and indexes
  persistence/research-store.ts # Transactional PostgreSQL adapter
  persistence/migrate.ts      # Explicit migration runner
  ../drizzle/                # Committed SQL migrations and Drizzle snapshots
```

To add Firecrawl, implement `WebSearch` and `PageReader`, run the provider contract tests against that adapter, and select it in composition. Core and plugin tool contracts should not change. No dynamic installation of external plugin code is supported.

Shared packages compile to ESM `dist` with declarations; Mastra packages those artifacts. `npm run dev:agent` builds them first. After editing a shared package, rebuild it and restart the agent. From root:

```sh
npm run lint
npm run typecheck
npm run db:up
npm test
npm run build
npm run start --workspace=@pickler/agent-service
```

The production build command still starts a local laboratory host, not a hardened deployment. Do not expose Studio through a public tunnel. Public login, external scheduling/queues, trading execution and on-chain contracts remain separate work.

Tests use controlled clocks, isolated PostgreSQL databases and explicitly injected test transports. They do not call paid providers or manufacture production results. Run the real `check` and a manual research job after supplying credentials; automated offline tests do not establish compatibility of an untested remote model.

Provider references: [Mastra workflows](https://mastra.ai/docs/workflows/overview), [custom routes](https://mastra.ai/docs/server/custom-api-routes), [PostgreSQL storage](https://mastra.ai/integrations/databases/postgresql), [Exa search](https://exa.ai/docs/reference/search), [Polymarket markets](https://docs.polymarket.com/api-reference/markets/list-markets), [market tags](https://docs.polymarket.com/api-reference/markets/get-market-tags-by-id).
