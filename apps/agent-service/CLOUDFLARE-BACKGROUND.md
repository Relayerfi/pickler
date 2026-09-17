# Local Cloudflare background research experiment

This experiment runs the existing tenant Hono API and Mastra-backed research runner in Cloudflare's local workerd runtime, with local Queues and a separate database inside Supabase. It does not deploy a public API or alter the retained remote runtime probe.

## Flow

1. `POST /agents/:id/runs` authenticates the lab token and durably enqueues a PostgreSQL job using the existing admission rules and idempotency key.
2. The API sends a generic queue wakeup and returns `202 { runId, status }`. It never awaits research. If wakeup delivery fails, the accepted PostgreSQL job remains queued for reconciliation.
3. The queue consumer acquires the database worker session lock, marks interrupted running jobs failed, and claims one queued job. It awaits the actual core research runner before releasing ownership. No research is detached through HTTP `waitUntil()`.
4. The caller polls `GET /runs/:runId`, for example every three seconds, until `completed`, `failed`, or `cancelled`. Polling only reads state. `GET /runs/:runId/events` returns evidence scoped to the authenticated tenant.
5. Each consumed job sends another wakeup to drain pending jobs. A periodic scheduled event creates due jobs and sends a wakeup, repairing missing notifications and interrupted consumers.

Messages contain only `{ kind: "research-wakeup" }`. Tenant identity, permissions, configuration, quotas, evidence and decisions come from PostgreSQL. Duplicate notifications can claim only unstarted jobs; they cannot repeat a running or terminal research. Provider failures are terminal failed runs, not valid abstentions or automatic paid retries. A crash after claim conservatively marks the run `INTERRUPTED` on the next successful ownership acquisition, preserving partial evidence.

## Local commands

From the repository root, with Supabase running and provider credentials configured in `apps/agent-service/.env`:

```sh
npm run build:shared
node apps/agent-service/src/cloudflare/background/client.mjs prepare
npx wrangler dev --config apps/agent-service/src/cloudflare/background/wrangler.jsonc --ip 127.0.0.1 --port 8799 --test-scheduled
```

Preparation creates `pickler_cf_queue_<random>` with explicit Drizzle migrations, seeds lab tenants, selects Sports (`1`) for alpha and leaves schedules disabled. Credentials are written to ignored files with owner-only permissions. It refuses to overwrite existing configuration. The worker rejects non-loopback database hosts and database names outside this isolated prefix. Do not run the Node worker against this database.

In a second terminal:

```sh
# Explicit paid diagnostics; required before enabling schedules.
node apps/agent-service/src/cloudflare/background/client.mjs check
# Explicit paid research; returns before completion.
node apps/agent-service/src/cloudflare/background/client.mjs run
# Read-only: repeat with the returned runId until terminal.
node apps/agent-service/src/cloudflare/background/client.mjs poll <runId>
# Simulate a Cron event locally; may execute already admitted/due work.
node apps/agent-service/src/cloudflare/background/client.mjs tick
```

Polling saves the current run and evidence under the ignored `.data/` directory and validates completed decision v2 documents. Set `RUN_KEY` to reuse an admission key intentionally. Distinct tenant tokens are generated locally; neither the model nor request bodies select a tenant. Existing schedule and pause API routes are unchanged. Enabling a schedule still requires successful connection checks and a completed manual investigation for the current configuration.

Wrangler does not automatically run local Cron events. Invoke `tick` to test reconciliation. The every-minute Cron declaration describes the intended deployed trigger, not an active local timer. The computer and Wrangler process must remain running for this local test.

## Guarantees and limits

- One active research worker globally, enforced with PostgreSQL session ownership even when local Queue delivery overlaps. This is a functional pilot, not a thousands-agent throughput design.
- Queue retries retry the wakeup; they never rewind a previously started investigation. Automatic recovery needs another queue delivery or scheduled event.
- Consumer concurrency is configured as one, but Cloudflare's local Queue emulator does not enforce that setting; the database lock remains necessary.
- No schema migration is needed: existing queued job rows form the durable pending-work record. Admission and notification are not one distributed transaction; reconciliation closes that gap.
- All polls currently create a request-scoped pool and initialize/check provider identity. This favors isolation and reuse in the experiment, not optimized production polling throughput.
- Retain the existing five-minute research deadline. Cloudflare documents a 15-minute Queue consumer wall-time limit; this does not prove capacity, production latency or provider budget.
- Public deployment, hosted Supabase wiring, production authentication, per-agent leases, horizontal concurrency, operational alerts and remote Queue recovery testing remain separate work.

References: [local Queues](https://developers.cloudflare.com/queues/configuration/local-development/), [delivery retries](https://developers.cloudflare.com/queues/configuration/batching-retries/), [Queue limits](https://developers.cloudflare.com/queues/platform/limits/).

## Validation

`npm run test:supabase` includes offline lifecycle integration tests using real isolated PostgreSQL databases. They verify durable acceptance after notification failure, polling and tenant isolation, duplicate wakeups, exclusive ownership before recovery, evidence preservation, pause and unconditional pool cleanup. Provider fixtures in those tests are never selected by the runtime.

Live validation on 2026-09-17 used the configured `deepseek-v4.1-flash` model, real Exa and Polymarket, local workerd Queues and the isolated Supabase database:

- First admission returned 202 in 79 ms. Run `b8517642-45ba-4a70-88f9-92f56b7db05a` failed with `MODEL_INVALID_OUTPUT` after 16.382 seconds; 13 events remained stored. The queue acknowledged the terminal failure without retrying the research.
- Explicit connection diagnostics passed model tool calling, structured output, Polymarket categories and Exa search/read.
- A new explicit admission returned 202 in 80 ms. Run `0426271e-e3dc-4dc8-acc8-00b08d7dacc1` completed in 92.142 seconds with a validated v2 `ABSTAIN`, eight cited source IDs and 26 persisted events. Polling observed both running and completed states after the admission process had exited.
- A simulated Cron event returned 200 during that research. Only the two explicitly admitted runs existed afterward: one failed and one completed. No extra research was created by the additional wakeup.
- Unauthenticated polling returned 401; beta polling alpha's completed run returned 404.
- All 57 automated tests, formatting, lint, types, workspace builds and the Cloudflare dry-run bundle passed.

This validates local asynchronous execution and persistence. It does not establish remote Queue behavior, production throughput, profitability or automatic recovery of paid research. The failed first model output remains a real limitation, not a successful decision.
