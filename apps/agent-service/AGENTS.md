# Agent service

Read ../../AGENTS.md and each affected package's AGENTS.md first.

This local research-only host owns Mastra integration, Studio workflows, HTTP transport, and worker lifecycle. Core owns authorization and research/scheduling rules. Infrastructure owns provider and PostgreSQL adapters. Never add trading or signing tools to this pilot.

Bind only to loopback. Studio is privileged local operator tooling, not tenant authentication. Pickler API routes resolve distinct local tokens server-side. Never trust model-supplied tenant identifiers. No paid calls at import or startup. Database URLs and provider credentials must stay untracked.

Use package exports, not relative cross-workspace source imports. Keep this file and README current. Run relevant tests, typecheck, lint, and build before submitting a PR.

## Structure and commands

Read [README.md](README.md) for the actual workflow and API contract. `src/mastra/index.ts` registers operator workflows and `/pilot/*`; `src/api/app.ts` maps tenant tokens and validates DTOs; `src/composition` is the only production location constructing concrete provider/store/model adapters. `src/plugins/registry.ts` wraps business capabilities with validated Mastra tools. `src/workers/main.ts` exclusively owns database recovery and execution; `launch.mjs` supervises it alongside Studio. `src/cli.ts` is an HTTP client and environment initializer.

`npm run dev:agent` at root builds shared ESM dependencies and starts Studio/worker. After shared source edits, rebuild and restart. `npm run agent -- init` creates an ignored environment file; all provider values must be supplied explicitly. Build must work without credentials and never contact paid providers. Use Node 22.22+.

Run root lint, typecheck, tests and build. Test files live in `test`. Test transports are fixtures only and must never be selected as a production fallback. Keep the researcher internal: exposing raw Mastra agent endpoints would bypass tenant queues and budgets. Studio workflows are the privileged operator entry point. Disable scheduling when provider identity or agent configuration changes. Preserve partial evidence on failure and interrupted work; never automatically repeat a started manual investigation.

Database setup: set `DATABASE_URL` for runtime and `DATABASE_MIGRATION_URL` for explicit Drizzle migrations. Use Supabase direct or session-pooler URLs, never the transaction pooler (port 6543). Run `npm run db:migrate` before startup. Mastra uses `@mastra/pg` with schema `mastra`; Pickler uses Drizzle with schema `pickler`. Only the process holding the PostgreSQL worker session lock may run restart recovery. Keep one worker for this pilot; multiple research workers require a lease-based recovery design first.

## Versioned prompts

Research and market-selection system instructions live in `src/prompts/research-system.ts` and `src/prompts/market-selection-system.ts`. Each immutable definition has an ID, semantic version, exact text and computed SHA-256 fingerprint. Bump the version whenever its text changes. The model adapter must consume the same definitions that it exposes through metadata. Connectivity probes remain fixtures in the adapter and are not research prompts.

Core persists the configured prompt snapshots in the first `runtime` event of a started investigation, before permission checks and provider calls. The market-selection definition is recorded even for manual-market runs, where selection is skipped. JSONB event storage needs no database migration. Queued/cancelled-before-start runs have no runtime snapshot, and historical runs are not backfilled. Agent profiles remain versioned user data in the run configuration and user message, never interpolated into trusted system instructions. Repository permissions and quotas are enforced by code.

JSON-mode compatibility: keep the explicit JSON instruction and generated output schema in both research prompt definitions. The compatible provider defaults to JSON-object mode without native schema transmission. The schema text is included in each prompt fingerprint, so schema edits also require a prompt version bump. Never remove runtime output validation or silently switch models.

Model output validation and safe failure classification live in `src/composition/model-output.ts`. Preserve HTTP status, known finish reason and numeric token counts only; never persist provider bodies, error messages, headers or reasoning text. Selection receives the runner clock as UTC `now`. Market-selection prompt version 1.0.2 incorporates that reference time.

For DashScope endpoints (`dashscope.aliyuncs.com` and `dashscope-intl.aliyuncs.com`), market selection explicitly sends `enable_thinking: false` through provider options. Research and connectivity probes retain provider defaults; research allows up to 32,768 output tokens per call while selection and connectivity probes remain capped at 2,000. This is a request setting, not a prompt instruction. Other compatible providers need their own documented controls; do not send DashScope-specific options to them.

Individual model requests allow 180 seconds. Always combine this timeout with the incoming abort signal so the five-minute research deadline and cancellation still take precedence.

Research prompt version 2.0.0 and connection schema probes use `modelAssessmentSchema`, not the persisted decision union. Only core creates the v2 final action and policy evaluation. The response retains final top-level fields for existing consumers and adds `schemaVersion`, original `modelAssessment`, and `policyEvaluation`. Probability ranges are subjective model estimates, not calibrated confidence intervals. No paid validation is implicit in schema changes.

The experimental Cloudflare runtime probe lives in `src/cloudflare`; read its local AGENTS.md and `CLOUDFLARE-PROBE.md` first. `wrangler.probe.jsonc` bundles the actual model and core runner for workerd. This is an operator-only compatibility experiment, not the production API, scheduler, tenant admission or a durable execution engine. Local PostgreSQL probes require an isolated database; remote ephemeral probes return evidence to the caller without remote persistence. No provider calls run on startup.
