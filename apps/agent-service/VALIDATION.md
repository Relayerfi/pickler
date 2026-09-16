# Pilot validation record

Validated locally on 2026-09-15. This records engineering verification, not research quality or profitability.

| Boundary                       | Evidence                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automated tests                | 25 passing tests covering HTTP tenant isolation, Mastra tool calling plus structured output, provider validation/usage, quotas, SQLite contention, schedule coalescing, pause/recovery, citations and quote refresh |
| Static checks                  | Repository ESLint and all workspace type checks pass                                                                                                                                                                |
| Build                          | Shared ESM packages, Next.js and Mastra build successfully; compiled Mastra starts with packaged shared dependencies                                                                                                |
| Studio                         | Browser inspection shows four workflows; `lab-presets` completed successfully using public Polymarket categories and persisted local fixtures; no browser console errors during this flow                           |
| Local HTTP                     | Authenticated agent list returns 200, absent token 401, cross-tenant resource 404 and untrusted Origin 403; compiled server also serves workflows and tenant API                                                    |
| Public provider                | Real Polymarket catalog returned 100 tags; tag 2 discovery returned 20 candidates; selected market rules/tags and an outcome order book were fetched and validated                                                  |
| Model integration              | Offline OpenAI-compatible transport fixture exercised actual Mastra tool invocation, two research search intents, per-step usage and structured decision parsing; no alternate model was selected                   |
| Paid providers / full research | **Pending operator credentials.** No real model/Exa connection check or full real-evidence decision has been claimed                                                                                                |

The startup checks used explicit nonfunctional test credentials and did not enqueue paid research. Automated fixtures are restricted to test files and temporary databases. The real public Polymarket check was read-only. Development and production-mode test servers were stopped after verification.

The installed Mastra LibSQL adapter does not implement its optional feedback listing feature. The pilot explicitly returns 501 for that Studio endpoint to avoid repeated framework stack traces. Workflow persistence and Pickler evidence are separate and were verified.

To complete acceptance, follow the README: configure actual provider values, start Studio, choose permitted categories, run the paid connection check, and complete a manual `research` workflow. A justified, source-backed abstention is valid. Only then enable the fixed schedule for that config version.
