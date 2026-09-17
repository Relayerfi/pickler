# Core package instructions

Read [the root instructions](../../AGENTS.md) first. Read the local instructions of any other project you inspect or change. Keep this file aligned with actual business modules, exports, and tests.

## Responsibility

`@pickler/core` owns the business layer: domain entities and invariants, application use cases, authorization rules, and ports for external capabilities. It must remain usable without Next.js or any specific provider.

Current source includes `application/get-health.ts`, `ports/clock.ts` and `features/research/{types,policy,run-research}.ts`. Public exports include research capability/repository ports, entities, configuration and schedule policy, decimal price comparison and `createResearchRunner`.

The runner owns permission rechecks, evidence attribution, bounded capability use and final quote verification. It accepts trusted scope from persisted jobs. API, Studio and scheduling share the same queue/runner. Core never accepts a model-supplied tenant or grants permissions from external content. Research failures and valid abstentions remain separate states.

## Rules

- No Next.js, React, HTTP request/response objects, ORM clients, provider SDKs, environment reads, or concrete infrastructure imports.
- Use plain input values and verified actor data. Enforce business authorization here, not only in UI or transport code.
- Define capability-specific ports here and inject implementations into use-case factories. Do not import infrastructure to construct a dependency.
- Domain models are not HTTP DTOs. Core may use `Date` or `bigint` internally; presentation maps them to public wire formats.
- Use typed business failures without HTTP status codes. Infrastructure should translate technical failures into errors the use case can understand.
- Keep public exports intentional in `src/index.ts`; use relative imports inside the package. Current lint rules prohibit dependencies on sibling runtime packages and agent SDKs from core. Relative imports use `.js` extensions for compiled Node ESM. `npm run build --workspace=@pickler/core` emits `dist`; public types resolve to source, runtime imports to compiled output.
- Do not add business rules that have not been specified by the product requirements.

## Checks

From root, run `npm test`, `npm run typecheck` and `npm run lint`. Root tests build shared packages first and include runner integration tests under infrastructure, which inject providers and use isolated PostgreSQL databases. Core health tests remain in `test`. Add framework-independent unit tests here for standalone domain policy. Do not move persistence implementations into core.

`ResearchModel.metadata()` includes two `PromptSnapshot` values (research and market selection): ID, version, SHA-256 and exact instructions. Core only persists these trusted adapter values in the first runtime event; prompt definitions and hashing stay in the agent service. Record metadata before permission checks/provider calls so failed started runs retain provenance too. This snapshot describes the runtime that starts a job, not a prompt version pinned at enqueue time.

Market eligibility requires an active, allowed market with a valid closing date strictly after the injected clock. Apply this before selection, after loading a manual or selected market, and on the final trade refresh. Missing dates are excluded conservatively. Preserve raw `candidates` and filtered `eligible_candidates` separately. `ResearchModel.select` receives the current UTC time. `ModelFailure` carries allowlisted adapter diagnostics; the runner persists `model_failure` before marking the run failed.

The research `outputTokens` cap is 32,768 per model call, including provider reasoning tokens. Core defaults to this cap; existing persisted agent configurations retain their values until explicitly updated. The agent-service caps selection and connection probes separately at 2,000.

Decision policy lives in `features/research/decision-policy.ts` and is exported as `evaluateDecision`. The model port returns `ModelAssessment` only. The runner saves `model_assessment`, validates existing evidence/market rules, refreshes quotes for trade proposals and applies deterministic policy before writing `DecisionV2`. Preserve the model proposal unchanged. Policy version 1.0.0 records its effective config, reason codes and evaluation time. Never upgrade model abstention or turn provider/schema failures into abstentions. Legacy configs without `uncertaintyPolicy` use conservative defaults; their snapshots are not rewritten. Legacy decisions remain readable without v2 claims.

The research runner requires `agent`, `event`, `finish` and `assertOwnership` repository methods. Admission, claims and process ownership remain responsibilities of its host; narrowing this dependency does not make the runner durable or permit bypassing production authorization.

Research ownership is checked before new provider/model operations, including the model adapter's `beforeStep` callback. Lease loss propagates without attempting a final decision write. Internal repository contracts include `renew` and operator-only `setConcurrency`; lease owner tokens must never enter model context or public DTOs. Hosts own heartbeat and recovery lifecycle; infrastructure owns atomic database fencing.
