# Local Supabase instructions

Read the root AGENTS.md before changing this directory. This configuration starts an isolated local Supabase stack for Pickler (CLI 2.111.0 verified). API, PostgreSQL and Studio use ports 54521, 54522 and 54523; preserve separation from other projects on this host.

Drizzle in packages/infrastructure owns Pickler migrations. Do not duplicate its SQL here or reset databases to apply application changes. Mastra initializes its own private schema. Expose only the configured public API schemas, never pickler, pickler_migrations or mastra. Local Supabase Auth is not integrated into Pickler's laboratory token authentication.

Use root npm scripts supabase:start, supabase:stop, supabase:status, db:migrate and test:supabase. Stop without deleting volumes. Generated .temp and .branches content must remain ignored. Never commit environment files or copy generated keys into documentation.

## Hosted project (pending reconciliation)

A hosted Supabase project (`pickler`, us-east-1) exists and already carries the product schemas the web app reads: `identity`, `agents`, `budget`, `audit`, `growth` and `market`. They were written as SQL migrations with the Supabase CLI and applied there after verification on a Supabase branch, before Drizzle was adopted as the single migration tool. The SQL is kept in `migrations/` as the record of what the hosted database contains.

Do not apply that SQL from here and do not add new SQL beside it. Migrating those schemas into `packages/infrastructure/src/persistence/schema.ts` (with custom Drizzle migrations for the security-definer functions, triggers and grants that Drizzle does not model) is infrastructure's call. Until that happens, treat the hosted schemas as read-only history: the connection URLs and the service key belong to the operator and are never committed.
