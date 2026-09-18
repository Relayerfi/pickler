# Core package instructions

Read [the root instructions](../../AGENTS.md) first. Read the local instructions of any other project you inspect or change. Keep this file aligned with actual business modules, exports, and tests.

## Responsibility

`@pickler/core` owns the business layer: domain entities and invariants, application use cases, authorization rules, and ports for external capabilities. It must remain usable without Next.js or any specific provider.

Current source layout:

```text
src/
  domain/                  # Reserved for shared domain models; currently empty
  features/                # landing, waitlist (see below)
  shared/                  # Cross-feature errors
  application/get-health.ts
  ports/clock.ts
  index.ts                 # Public exports
test/                      # Package-root tests, alongside src/
```

Features:

```text
src/
  shared/errors.ts                         # DataSourceUnavailableError
  features/landing/
    domain/landing.ts                      # LandingSnapshot read model and value types
    ports/landing-read-model.ts            # LandingReadModel
    application/get-landing.ts             # createGetLanding: ordering and display limits
  features/access/
    domain/                                # Abilities (CASL), principal, permission decision, modules, scopes, IP allowlist, errors
    ports/                                 # AccessTokenVerifier, WorkspaceDirectory, ApiKeyDirectory
    application/authenticate-request.ts    # Bearer JWT or API key → principal + workspace
  features/agent-registry/
    domain/                                # RegisteredAgent (agent.agents without secrets), events, analytics aggregation, audit query parsing
    ports/agent-registry.ts                # AgentRegistry, AgentEventLog
    application/agent-queries.ts           # Tenant-isolated list/get/status/analytics/audit
    application/authenticate-agent.ts      # Agent SDK HMAC verification
  features/budget/
    domain/amounts.ts                      # micro-USD parsing (non-negative integers), exact USD → micro-USD
    domain/ledger.ts                       # Reservation ledger (reserve/commit/release/record/configure/hydrate/snapshot) over a sync LedgerStore
    ports/budget-source.ts                 # Read-only budget rows from agent.agent_budgets
  features/signing/
    domain/turnkey-activity.ts             # Turnkey activity shape, signed request, forward expectations, signing errors
    ports/signing.ts                       # SignedActivityForwarder, TurnkeyReader
  features/profiles/
    domain/profile.ts                      # Display name and @handle rules, reserved handles, profile errors
    ports/profile-repository.ts            # ProfileRepository (atomic create)
    application/profiles.ts                # checkHandle, getProfile, createProfile (idempotent per user)
  features/agents/
    domain/agents.ts                       # AgentSummary, AgentProfile, PickDetail, agentSlug
    ports/agent-directory.ts               # AgentDirectory
    application/agents.ts                  # createListAgents (ranked by record), createGetAgentProfile, createGetPickDetail
  features/applications/
    domain/application.ts                  # Validation, ticker/handle/referral rules, REFERRAL_BOOST, errors
    ports/applicant-repository.ts          # ApplicantRepository
    application/applications.ts            # createGetApplicant, createSubmitApplication, createCheckTicker
  features/waitlist/
    domain/email.ts                        # normalizeEmail, InvalidEmailError
    ports/waitlist-repository.ts           # WaitlistRepository
    application/join-waitlist.ts           # createJoinWaitlist: apply token only for new seats or its holder
```

Tests: `test/health.test.ts`, `test/landing.test.ts`, `test/waitlist.test.ts`, `test/applications.test.ts`, `test/agents.test.ts`, `test/access.test.ts`, `test/authenticate-request.test.ts`, `test/agent-registry.test.ts`, `test/budget-ledger.test.ts`. `features/agent-registry` (Relayer's operational agents) is distinct from `features/agents` (the public board read model). `features/access` is ported from Relayer; each file names its source and behaviour changes. Category and personality lists are duplicated as wire values in `@pickler/api-schema`; change both together. The landing snapshot is a presentation read model with MON amounts as display numbers; do not use it for accounting. Organize new features under `src/features/<feature>/{domain,application,ports}`; do not create speculative modules in advance.

## Rules

- No Next.js, React, HTTP request/response objects, ORM clients, provider SDKs, environment reads, or concrete infrastructure imports.
- Use plain input values and verified actor data. Enforce business authorization here, not only in UI or transport code.
- Define capability-specific ports here and inject implementations into use-case factories. Do not import infrastructure to construct a dependency.
- Domain models are not HTTP DTOs. Core may use `Date` or `bigint` internally; presentation maps them to public wire formats.
- Use typed business failures without HTTP status codes. Infrastructure should translate technical failures into errors the use case can understand.
- Keep public exports intentional in `src/index.ts`; use relative imports inside the package. Current lint rules prohibit dependencies on sibling runtime packages from core.
- Do not add business rules that have not been specified by the product requirements.

## Checks

From the repository root, run `npm run typecheck --workspace=@pickler/core`, `npm test`, and `npm run lint` as relevant. Tests use Node's test runner with `tsx`. The root test command finds `packages/core/test/*.test.ts` and `packages/infrastructure/test/*.test.ts`; update it if introducing nested tests or other suites. Use injected test doubles to check success, rejection, and authorization paths without networking or framework startup.
