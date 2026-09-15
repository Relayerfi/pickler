# Architecture

## Three layers and dependency direction

1. **Presentation** (`apps/web`): pages, product-specific components, and HTTP adapters. Route Handlers validate input, obtain authenticated identity, call a use case, and map its result to a DTO and HTTP status. They do not contain business rules or direct provider calls.
2. **Business** (`packages/core`): entities, rules, use cases, and ports for persistence, external services, and blockchain operations. No Next.js, React, ORM, or provider SDK imports. The current layout has `domain`, `application`, and `ports`; organize future business features under `features/<feature>/{domain,application,ports}` when needed.
3. **Infrastructure** (`packages/infrastructure`): implementations of the ports, including repositories and provider/RPC adapters. Infrastructure depends on business; business never depends on infrastructure.

Runtime flow is HTTP → use case → adapter. Code dependencies are inverted through interfaces: presentation → business ← infrastructure. `apps/web/src/server/container.ts` is the current composition root, protected by `server-only`. The proposed independent agent service will have its own server composition root at `src/composition/container.ts`; both hosts consume the same business ports and rules. ESLint checks direct imports across key boundaries; these checks are guardrails, not a substitute for reviewing transitive dependencies. Next.js rejects importing the protected server boundary into a Client Component.

`api-schema` contains public HTTP contracts only. `ui` knows nothing about use cases, authentication, wallets, or providers. Keep interactive client boundaries small instead of making the entire UI library client-only.

## Next.js

Use App Router, Server Components by default, and Node.js Route Handlers. Server Components can call the server facade directly without making an HTTP request to their own API. Clients and external consumers use `/api/v1/*`. Use cases receive plain data and verified identity, never `NextRequest`, cookies, or framework session objects.

As business operations are introduced, add runtime validation for inputs and external responses, use-case authorization, typed errors, and a shared HTTP error mapper. Do not expose internal exception details. Choose caching explicitly for each endpoint; health currently returns `no-store`.

See [the web app instructions](../apps/web/AGENTS.md) for a folder example and a walkthrough of the existing three-layer implementation.

## External services

Define a port for each required business capability, such as `PaymentGateway`, then implement an adapter after choosing a provider. Avoid a generic abstraction for unrelated providers. Configuration and credentials stay on the server; only public values may use `NEXT_PUBLIC_*`.

Adapters should provide timeouts, response validation, and normalized errors. Retry only safe operations or operations protected by idempotency keys. Verify webhook signatures against the original body and deduplicate events. Introduce a separate worker for long-running tasks or indexers when required; do not keep a Next.js request running indefinitely.

## On-chain boundary

`contracts` is the source of truth for Solidity code. Once contracts exist, generate ABIs from compiler artifacts into `packages/chain`, rather than copying them manually. Record addresses and deployment blocks by chain ID and contract version. Public packages must not contain private keys or credential-bearing RPC URLs.

Server-side reads use infrastructure adapters implementing business ports. Wallet connection and user signing belong to the frontend and must never require sending the user's private key to the backend. Operational server signing, if required, needs an explicit custody and permissions design.

A submitted transaction is not a finalized operation. When implementing writes, model pending, confirmed, and failed states; account for network-specific confirmations, replacements, and reorganizations. Deduplicate events by network, transaction hash, and log index. Off-chain storage and blockchain writes are not atomic: introduce persistent state, idempotency, and reconciliation when these operations are added.

Monad is the launcher direction. The agent pilot targets Polymarket execution with Exa research through Mastra, as specified in [agent runtime V1](specs/agent-runtime-v1.md). These are planned integrations, not deployed capabilities. Contract parameters, wallet authority, authorization rules, confirmation policy, and concrete infrastructure remain unresolved. No agent SDK or provider has been provisioned.

## Planned independent agent service

The [agent runtime V1 specification](specs/agent-runtime-v1.md) defines `apps/agent-service` as a new host for Mastra, internal Studio, API handlers, scheduling, and workers. Its business rules remain in core and provider adapters in infrastructure. The existing frontend can evolve independently against the proposed API. This service is not yet scaffolded and does not require moving the existing health endpoint or implementing the launcher.

## Future backend extraction

Create `apps/api` when needed. It will consume the same `core`, `infrastructure`, and `api-schema` packages, provide its own composition root, and expose the same `/api/v1` contract. Next.js can retain a facade or consume the new backend over HTTP. Use cases remain unchanged; transport, sessions, configuration, and deployment still need adaptation. Do not create an extra process merely to simulate a future migration.

Internal TypeScript packages expose source files that Next.js transpiles. A future backend running directly on Node must compile its dependencies or use a bundler.

## Validation and documentation

Turborepo coordinates builds and type checks. ESLint checks conventions and import boundaries. One test exercises the use case with an injected clock. Add domain-rule and adapter-contract tests as real functionality is introduced. Solidity requires unit, fuzz, and invariant testing before deployment; current contract directories are empty.

Read the root and relevant project `AGENTS.md` before working in any project. Update local instructions alongside changes to structure, exports, commands, or responsibilities. Keep documentation in English and distinguish working code from proposed examples.

References: [Next.js backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Turborepo internal packages](https://turborepo.dev/docs/core-concepts/internal-packages).
