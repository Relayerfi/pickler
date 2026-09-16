# Pilot validation record

PostgreSQL migration verified locally on 2026-09-16. This records engineering verification, not research quality or profitability.

| Boundary                       | Evidence                                                                                                                                                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence                    | Real PostgreSQL 17 in Docker; Drizzle migrations applied to isolated databases for each integration test                                                                                                                                                  |
| Migration command              | `npm run db:migrate` applied the initial migration and completed again without duplicating tables                                                                                                                                                         |
| Schema drift                   | `npm run db:generate` reports no schema changes after the committed migration                                                                                                                                                                             |
| Automated tests                | 28 passing tests covering tenant HTTP isolation, Mastra tool/structured output fixtures, provider contracts, PostgreSQL quotas/idempotency, simultaneous claims and schedules, exclusive database worker ownership, recovery, citations and quote refresh |
| Mastra storage                 | `@mastra/pg` initialized the separate `mastra` schema and returned workflow storage against local PostgreSQL                                                                                                                                              |
| Static checks                  | Repository ESLint, formatting and workspace type checks pass                                                                                                                                                                                              |
| Build                          | Shared ESM packages, Next.js and Mastra build successfully without provider credentials                                                                                                                                                                   |
| Supabase hosted connection     | Pending operator project connection URLs; local PostgreSQL verification does not claim a hosted Supabase deployment                                                                                                                                       |
| Paid providers / full research | Pending operator credentials; no real model/Exa connection check or full real-evidence decision is claimed                                                                                                                                                |

The previous SQLite revision was also checked in Studio on 2026-09-15: the public-category/preset workflow and live read-only Polymarket categories, discovery, market rules/tags and order books worked. Those historical checks do not establish that the new Supabase deployment is configured. Test transports remain fixtures only, and no paid calls run in automated tests.

The runtime now uses a PostgreSQL session advisory lock instead of a local file lock. One worker owns recovery and processes jobs serially. The database adapter separately tests safe concurrent admission, quota enforcement, claims and schedule deduplication. Multiple active research workers remain outside this pilot's recovery model.

To complete acceptance, follow the README: configure Supabase direct/session connection URLs and provider values, apply migrations, start Studio, select categories, run the paid connection check, and complete a manual research workflow. A justified, source-backed abstention is valid. Enable scheduling only afterwards. Existing SQLite files are preserved but not automatically imported.

## Local Supabase verification

On 2026-09-16, Supabase CLI 2.111.0 started the full local stack using project `pickler-monorepo` and ports 54521/54522/54523. Drizzle migrations applied successfully; all 28 tests passed against this Supabase PostgreSQL instance. The Mastra adapter wrote, loaded and deleted a workflow snapshot in its separate schema. Studio returned HTTP 200. Both laboratory agents were seeded without model/provider calls. The ignored app `.env` contains local database URLs and generated tenant tokens; model and Exa values remain empty.

The first image download was interrupted when Docker stopped responding; reopening Docker and retrying completed successfully. The Supabase stack is left running for operator inspection. Hosted Supabase and paid-provider acceptance remain pending.
