# Core package instructions

Read [the root instructions](../../AGENTS.md) first. Read the local instructions of any other project you inspect or change. Keep this file aligned with actual business modules, exports, and tests.

## Responsibility

`@pickler/core` owns the business layer: domain entities and invariants, application use cases, authorization rules, and ports for external capabilities. It must remain usable without Next.js or any specific provider.

Current source layout:

```text
src/
  domain/                  # Reserved for domain models; currently empty
  application/get-health.ts
  ports/clock.ts
  index.ts                 # Public exports
test/                      # Package-root tests, alongside src/
```

The actual test is `test/health.test.ts`. `createGetHealth` and the `Clock` interface are the current public API. As real features appear, prefer `src/features/<feature>/{domain,application,ports}`; do not create speculative modules in advance.

## Rules

- No Next.js, React, HTTP request/response objects, ORM clients, provider SDKs, environment reads, or concrete infrastructure imports.
- Use plain input values and verified actor data. Enforce business authorization here, not only in UI or transport code.
- Define capability-specific ports here and inject implementations into use-case factories. Do not import infrastructure to construct a dependency.
- Domain models are not HTTP DTOs. Core may use `Date` or `bigint` internally; presentation maps them to public wire formats.
- Use typed business failures without HTTP status codes. Infrastructure should translate technical failures into errors the use case can understand.
- Keep public exports intentional in `src/index.ts`; use relative imports inside the package. Current lint rules prohibit dependencies on sibling runtime packages from core.
- Do not add business rules that have not been specified by the product requirements.

## Checks

From the repository root, run `npm run typecheck --workspace=@pickler/core`, `npm test`, and `npm run lint` as relevant. Tests use Node's test runner with `tsx`. The root test command currently finds only `packages/core/test/*.test.ts`; update it if introducing nested tests or other suites. Use injected test doubles to check success, rejection, and authorization paths without networking or framework startup.

## Planned agent pilot

The planned [agent runtime V1](../../docs/specs/agent-runtime-v1.md) assigns identity, agents, capabilities, research, markets, execution, budgets, scheduling, and runs to feature modules here. This is a proposed layout, not current exports. Keep Mastra out of core; use trusted tenant scope, business-owned capability ports, versioned configuration, and deterministic policy/budget checks.
