# Pickler

A monorepo using npm workspaces, Turborepo, Next.js App Router, and strict TypeScript.

## Development

Use Node 22 or newer and npm 10.9.3. Run from the repository root:

```sh
npm ci
npm run dev
```

Web: http://localhost:3000. Liveness endpoint: `/api/v1/health`.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Repository structure

```text
apps/web/src/
  app/                      # Presentation: pages and Route Handlers
    api/v1/health/route.ts
  server/container.ts       # Server-only composition and dependency injection
packages/
  core/src/                 # Business: domain, use cases, and ports
  infrastructure/src/       # Adapters: clock; future persistence/API/RPC clients
  api-schema/src/           # Public, serializable HTTP DTOs
  ui/src/                   # Product-independent React components and styles
  chain/src/                # Public types; future ABIs and per-network deployments
  typescript-config/        # Shared TypeScript configuration
contracts/                  # Independent Foundry project
  src/                      # Solidity contracts
  test/                     # Unit, fuzz, and invariant tests
  script/                   # Deployment scripts
```

The initial implementation connects a Route Handler to a use case and an injected system clock. The health endpoint checks that the application responds; it does not check external dependencies. No providers, database, wallet, or business contracts are connected yet. The initial HTTP contract is expressed in TypeScript; future request inputs require runtime validation.

See [architecture decisions](docs/architecture.md) and [repository agent instructions](AGENTS.md). Every app and package has its own `AGENTS.md`; read it before working in that project and update it when the project changes. Repository documentation is maintained in English.

## Solidity

Foundry configuration and directories are included. Contracts remain undefined until their business rules, permissions, and target network are established. These commands require Foundry:

```sh
npm run contracts:build
npm run contracts:test
```

On-chain deployments run explicitly, never as a side effect of `build`. Solidity has its own toolchain; contract commands are independent of web tasks. The current source and test directories are empty.
