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
