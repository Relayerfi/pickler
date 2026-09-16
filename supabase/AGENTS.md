# Local Supabase instructions

Read the root AGENTS.md before changing this directory. This configuration starts an isolated local Supabase stack for Pickler (CLI 2.111.0 verified). API, PostgreSQL and Studio use ports 54521, 54522 and 54523; preserve separation from other projects on this host.

Drizzle in packages/infrastructure owns Pickler migrations. Do not duplicate its SQL here or reset databases to apply application changes. Mastra initializes its own private schema. Expose only the configured public API schemas, never pickler, pickler_migrations or mastra. Local Supabase Auth is not integrated into Pickler's laboratory token authentication.

Use root npm scripts supabase:start, supabase:stop, supabase:status, db:migrate and test:supabase. Stop without deleting volumes. Generated .temp and .branches content must remain ignored. Never commit environment files or copy generated keys into documentation.
