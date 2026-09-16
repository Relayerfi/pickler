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

## Versioned prompt verification

The research and market-selection instructions are separate versioned modules. The extraction preserves the research text byte-for-byte. The 29-test suite passes against local Supabase, including exact system-prompt metadata/hash checks, user-profile separation in actual Mastra request payloads, and prompt snapshots persisted before provider calls and on failed started runs. Snapshots include full instructions and use existing JSONB runtime events; no migration is needed. Historical runs are not backfilled.

## First live provider check and sports investigation

On 2026-09-16, the configured `deepseek-v4.1-flash` model at DashScope passed the actual tool-call and structured-decision probes. Exa search and page reading passed, and the public Polymarket category API returned 100 entries. This supersedes the earlier pending connection-check status, but not full research acceptance.

The live check exposed JSON-mode compatibility requirements: requests must explicitly mention JSON, and the OpenAI-compatible adapter does not transmit a native JSON Schema by default. Prompt version 1.0.1 includes the output schema in the instructions; diagnostic fixtures also include it. Runtime validation remains enabled and no model fallback was introduced.

The operator selected Sports (verified Polymarket tag ID 1). Alpha configuration version 2 uses that category with scheduling disabled. One manual run, `725b1217-483c-4791-9508-8e995715d4bd`, persisted runtime prompt snapshots and candidates, then failed before selection completed with `PROVIDER_OR_MODEL_FAILURE`. It has no decision and is not a valid abstention. The existing generic failure code does not establish the precise model failure cause; model-stage diagnostics need improvement before another paid attempt. The run was not automatically retried. Full research acceptance and scheduling remain pending.

The 29-test Supabase suite passes after the compatibility change. Tests now require JSON instructions and explicit schema requirements in the configured research prompts and structured connection probe. Offline fixtures still do not establish a completed live research run.

## Market selector isolation and regression coverage

An isolated replay of the saved sports candidates on 2026-09-16 succeeded with the unchanged configured model: HTTP 200 and a validated selection, with 1,091 reported output tokens including 986 reasoning tokens. This does not identify the historical failure cause or constitute a full research run. It exposed a stale closing date being described as future.

The runner now excludes expired, boundary-time, missing and invalid closing dates; rechecks manual/selected markets and final trade refreshes; and passes its clock to selection. Prompt version 1.0.2 references that clock. Safe model diagnostics retain stage, status, finish reason and numeric usage when available. Regression fixtures cover truncation, malformed structured output, HTTP failures, timeout/cancellation, metadata redaction and preservation of partial evidence. No additional paid research run or scheduling activation is part of this correction.

Validation: all 38 tests pass against local Supabase. Repository lint, format and type checks pass, and the full Next.js/Mastra build succeeds. The selector transport fixture also verifies an actual Mastra HTTP 429 is preserved as `MODEL_HTTP_429`.

## Selector reasoning control

The explicitly requested full retry `8b867c96-741a-4499-b058-8581f08068e8` failed in selection with `MODEL_OUTPUT_TRUNCATED`: 2,000 output tokens, all reported as reasoning, and no decision. DashScope selection now sends `enable_thinking: false`; research retains its provider default and the 2,000-token cap is unchanged. An isolated real selector call with saved eligible candidates succeeded with 125 output tokens and zero reasoning tokens. This verifies selection only; no new full research run is claimed. All 38 tests pass, including transport assertions that the setting is present only on selection requests.

Provider reference: [DashScope thinking controls](https://www.alibabacloud.com/help/en/model-studio/deep-thinking).
