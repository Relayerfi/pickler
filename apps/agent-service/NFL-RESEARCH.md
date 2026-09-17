# Configurable NFL research

The `nfl-winner-v1` protocol covers NFL full-game moneyline markets only. It retains the two-phase Mastra flow and existing execution leases. Research and final decision share twelve model steps, the existing token cap and a five-minute deadline. It does not imply forecasting profitability.

## Plugins and configuration

Reviewed plugins are `polymarket`, `exa`, `balldontlie`, `the-odds-api` and (in the next delivery) `paper-trading`. Core owns permissions and capability ports; infrastructure owns provider calls and storage; the service binds them and exposes validated tools. No external code installation occurs.

Configuration adds `plugins: { version: 1, enabled: [...] }` and optional `researchProtocol: "nfl-winner-v1"`. A tool requires both its individual permission and its owning plugin. Historic configurations infer only Exa/Polymarket permissions from existing tools. Sports providers never become enabled implicitly. Versioned updates materialize the plugin configuration without rewriting run snapshots.

Polymarket and web search are required. The sports providers are optional; disabled, missing credentials, absent coverage, stale data and technical failure are distinct conditions. An invoked provider failure remains a failed investigation. A configuration change blocks new calls, cache reads and result writes; previously stored evidence remains available. Requests already sent may incur usage.

Explicit operator migration, from the repository root after shared builds and database migration:

```sh
npm run configure:nfl --workspace=@pickler/agent-service
# Explicitly enable both optional sports sources only after configuring their keys:
npm run configure:nfl --workspace=@pickler/agent-service -- --sports
```

This updates both lab agents through the normal versioned configuration path and disables scheduling. It preserves their categories and existing tool permissions; select an NFL-compatible category before discovery. NFL configuration requires `pre-event` discovery. The API configuration endpoint also supports individual toggles.

Optional environment variables: `BALLDONTLIE_API_KEY`, `THE_ODDS_API_KEY`. Neither startup nor activation makes provider calls. Explicit per-agent checks: `POST /agents/:id/plugins/:plugin/check` with the tenant token (under `/pilot` in Studio). Existing model connection checks remain explicit operator actions.

## Evidence and limitations

BALLDONTLIE free access supplies teams and games, not injuries, rosters or advanced statistics. Matching requires both teams and a unique scheduled event within fifteen minutes of Polymarket's start. No ambiguous event is accepted as verified. The bounded lookback provides recent final games where available.

The Odds API supplies NFL `h2h`, US bookmakers and decimal prices. Reference odds retain their original update times and bookmaker attribution; they are not model probabilities. Ties, overtime, cancellations and bookmaker margins may prevent comparison. Distinct bookmakers or websites are not automatically independent evidence.

Public provider data is cached in private PostgreSQL tables: teams 24 hours, game context five minutes, odds two minutes. Cache reads require current permissions. Retrieval time never resets when served from cache. Shared key quotas are coordinated transactionally: five BALLDONTLIE requests/minute and a conservative 500 Odds API requests/month. Calls made outside Pickler are not included; provider errors still take precedence. Exhaustion fails explicitly without retries. Each research allows at most six BALLDONTLIE and two odds HTTP requests, including pagination.

Decision v3 retains legacy top-level fields and adds a separate forecast and section-by-section coverage. Abstention can preserve an estimate; inability to estimate is explicit. Core verifies citations, probability order and agreement between a trade and its forecast. This validates attribution and consistency, not the truth of every model statement. Decisions v1/v2 remain readable. Decisions and provider evidence use existing run/event JSONB; public cache/quota tables require migration 0003.

## Evaluation

```sh
npm run build:shared
npm run evaluate:nfl --workspace=@pickler/agent-service -- --all-six
```

This is an explicit paid model evaluation using six synthetic frozen-evidence scenarios, without Exa or sports API calls. It is excluded from CI. Results and usage are stored in ignored `.data/nfl-evaluation-v1`. An attempted case is not repeated automatically; a model error stops evaluation and leaves reliability acceptance pending. Fixtures are never production fallbacks.

Live acceptance is limited to two complete investigations. Missing sports credentials block full provider acceptance. A justified abstention is valid; a fabricated result or an output failure is not. Record real results separately from fixtures.

Run format, lint, types, PostgreSQL/Supabase tests and Node/Cloudflare builds. Apply migrations to isolated databases first. Stop old executors before upgrading existing databases, then migrate and restart. Never expose `pickler` through Supabase's Data API.

Deferred work: #11 resolution/settlement, #12 calibration, #13 automatic portfolio lifecycle, #14 verified injury/advanced data, #15 additional protocols, #16 tenant credentials/UI. Shared observability remains #5.

## Validation record (2026-09-17)

PostgreSQL and Supabase suites passed 97 tests before the final diagnostic refinements. One of six paid fixture evaluations was attempted: `clear-edge` returned structured output but failed core report validation after 66.848 seconds (`INVALID_RESEARCH_REPORT`). The initial evaluator did not preserve the rejected assessment or usage, so the exact violated invariant is unproven. The evaluator now preserves step diagnostics and usage; report validation distinguishes protocol, section, attribution, forecast and trade-consistency errors. No case was repeated, and the other five were not consumed. Live acceptance remains pending; no claim of model reliability is made. The two sports keys were absent when checked, and no full live investigation was launched for this delivery.
