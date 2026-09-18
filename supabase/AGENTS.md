# Supabase instructions

Read [the root instructions](../AGENTS.md) and [infrastructure instructions](../packages/infrastructure/AGENTS.md) first. Keep this file current when the schema or functions change.

`supabase/` holds the Supabase CLI project: `config.toml` and SQL migrations. There is no seed: sample content lives in the infrastructure sample adapters, not in the database.

## Project and workflow

- Supabase project `pickler` (ref `yvdipvcrpbqvofayteqf`, us-east-1). Relayer's project is separate and is not touched from this repository.
- One project; test changes on a **branch** (created from the dashboard or MCP, billed hourly), then apply the same migration files to the main project and delete the branch.
- Never edit an applied migration; add a new one.

Applied to `pickler` on 2026-09-16, each batch verified first on a branch: all nine migrations below.

## Data model: one schema per domain

Nothing lives in `public`. Every table has RLS enabled with no policies, API roles (`anon`, `authenticated`) have no grants, and `service_role` gets only the privileges it needs. Append-only tables reject `update`/`delete` through `internal.reject_mutation()`, including for `service_role`.

| Migration | Schema | Contents |
| --- | --- | --- |
| `20260917010000_internal.sql` | `internal` | `set_updated_at()` and `reject_mutation()` trigger functions. Never exposed. |
| `20260917010100_identity.sql` | `identity` | `profiles` (one per `auth.users` id, unique `@handle`), `wallet_links` (SIWE-verified addresses), `workspaces` (a creator's space; one owned per user), `workspace_members` (role enum), `api_keys` (SHA-256 hash, scopes, CIDRs, revocation). |
| `20260917010200_agents.sql` | `agents` | `agents` (many per workspace, unique ticker, status enum, `killed_at` consistency), `agent_profiles` (public blurb, accent, X handle), `agent_configs` (append-only versions; `agents.active_config_version` points at one), `agent_credentials` (AES-256-GCM HMAC secret), `agent_events` (append-only). |
| `20260917010300_budget.sql` | `budget` | `budgets` (per agent and category, micro-USD) and `ledger_entries` (append-only, unique per reservation and action). The `AgentLedger` Durable Object is the live authority; these are its durable projection. |
| `20260917010400_audit.sql` | `audit` | `events` (append-only) and `idempotency_keys`. |
| `20260917010500_growth.sql` | `growth` | `waitlist` and `applications`, reached only through `security definer` functions: `join_waitlist(p_email, p_referral_code)`, `applicant_by_token(p_token)`, `ticker_available(p_ticker)` (checks launched agents too) and `submit_application(...)` (returns an outcome string, also on unique-violation races). |
| `20260918010000_handles.sql` | `identity`, `agents` | `identity.handles`: one `@handle` namespace for people **and** agents (exactly one owner; profiles and agents reference their own handle with composite FKs, renames cascade). `handle_history` keeps released handles blocked for 30 days. Functions `handle_available(p_handle)` and `create_profile(p_user_id, p_display_name, p_handle)` (returns `created`, `handle_taken` or `user_has_profile`). `agents.agents` drops `ticker` and gains `handle`. `wallet_links` becomes unique per chain family (`eip155`, `solana`) and address, with `verified_chain` (CAIP-2), `method` `siwe`/`siws` and `kind` `external`/`mera`. |
| `20260918010100_market.sql` | `market` | Agent tokens and their trading, projected from chain events (see `docs/market/token-launch.md`). `tokens` (one live token per agent, ticker reserved on approval, lifecycle `reserved → launching → pre_graduation → graduated` or `failed`), `pools` (curve before graduation, Pons or Uniswap V4 after, by address or PoolId), `fee_splits`, `fee_payouts`, `trades`, `holders`, `candles`, `indexer_cursors`. uint256 amounts as `numeric(78,0)`; log-derived rows are insert/delete only (reorgs). |
| `20260918010200_growth_tokens.sql` | `growth` | `applications.agent_id` links an approved application to its agent; `ticker_available` and `submit_application` check `market.tokens` (non-failed) instead of agents. |

Planned schemas: `wallets` (Turnkey sub-orgs, wallets, policies on Monad; do not name it `custody`) and `trading` (Perpl orders, fills, positions). Nothing writes `market` yet (the indexer waits for the launch contracts), so the landing and agent board still use sample adapters. Agent creation will need a function that inserts the agent and its handle together, like `create_profile`.

## Project settings (dashboard, not code)

- Data API → exposed schemas: `identity`, `agents`, `budget`, `audit`, `growth`, `market` (matches `config.toml`). Grants still restrict them to `service_role`.
- Auth: enable Web3 (Ethereum) sign-in; add the `/signin` and `/signup` URLs to the redirect allowlist; minimum password length 8 to match the form.

## Rules

- Enable RLS on every table. Expose data through the service role from server code, or through `security definer` functions with `set search_path = ''` granted only to `service_role`, unless a reviewed policy says otherwise.
- Keep the constraint and index names the adapters map (`profiles_handle_key`, `handles_pkey`, `applications_ticker_key`, `applications_x_handle_key`).
- Index foreign keys; `get_advisors` must report no warnings beyond "RLS enabled, no policy" (intentional) and unused indexes on an empty database.
- When changing a function's JSON shape, update the matching zod schema and regenerate the fixture in `packages/infrastructure/test/fixtures` from the real function output.
- Keep secret keys out of the repository and out of `NEXT_PUBLIC_*` variables.

## Checks

On a Supabase branch: apply the migrations, run a `do` block that exercises constraints and role grants (`set local role anon|authenticated|service_role`) and ends with an exception so nothing persists, then `get_advisors` for security and performance. Without Docker, the migrations also run in PGlite after creating stub `auth.users` and the `anon`, `authenticated` and `service_role` roles. Then run `npm test` from the repository root.
