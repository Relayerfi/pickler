# Repository instructions

## Read the local instructions first

Before inspecting, reviewing, planning changes to, or editing any app or package, read this file and that project's own `AGENTS.md`. Also read any more specific `AGENTS.md` files along the path to the files you will touch. Repeat this lookup whenever you move into another project, including dependencies affected by a change. Read the current files from disk rather than assuming earlier context is still up to date.

Root instructions apply throughout the repository. Local instructions supplement them within their directory; more specific instructions take precedence within their scope unless they conflict with an explicit user instruction. If an app or package has no local `AGENTS.md`, create one as part of work that establishes or changes that project.

Keep each project's `AGENTS.md` updated in the same change whenever its structure, public exports, responsibilities, commands, or architectural constraints change. Describe the actual implementation and label proposed examples clearly. All repository documentation and agent instructions must be written in English.

## Project map

| Project | Responsibility | Required local instructions |
| --- | --- | --- |
| `apps/web` | Next.js presentation and HTTP entry points | [AGENTS.md](apps/web/AGENTS.md) |
| `workers/api` | Backend API on Cloudflare Workers (Hono), ported from Relayer | [AGENTS.md](workers/api/AGENTS.md) |
| `packages/core` | Business rules, use cases, and ports | [AGENTS.md](packages/core/AGENTS.md) |
| `packages/infrastructure` | Implementations of business ports | [AGENTS.md](packages/infrastructure/AGENTS.md) |
| `packages/api-schema` | Public HTTP DTOs | [AGENTS.md](packages/api-schema/AGENTS.md) |
| `packages/ui` | Reusable React components and styles | [AGENTS.md](packages/ui/AGENTS.md) |
| `packages/chain` | Public blockchain metadata and future generated ABIs | [AGENTS.md](packages/chain/AGENTS.md) |
| `packages/typescript-config` | Shared compiler configuration | [AGENTS.md](packages/typescript-config/AGENTS.md) |
| `contracts` | Foundry/Solidity project | [AGENTS.md](contracts/AGENTS.md) |
| `supabase` | Postgres schema, RPC functions, and local seed | [AGENTS.md](supabase/AGENTS.md) |

See [README.md](README.md) for setup and [docs/architecture.md](docs/architecture.md) for architectural decisions.

## Architecture invariants

- Maintain three layers: presentation (`apps/web`), business (`packages/core`), and infrastructure (`packages/infrastructure`). Code dependencies point toward business: presentation → business ← infrastructure.
- Only server composition code in `apps/web/src/server` connects concrete adapters with use cases. Protect this boundary with `server-only`.
- Keep Next.js, React, transport objects, database clients, and provider SDKs out of core. Use business-owned interfaces and dependency injection.
- Keep HTTP DTOs in `api-schema`; keep public on-chain artifacts in `chain`. Neither package carries credentials or server implementation details.
- Use declared workspace dependencies and public package exports. Do not bypass package boundaries with relative imports into another project's source.
- Supabase (Postgres) is the selected store for landing data and the waitlist, accessed only from the server through infrastructure adapters. Other providers, networks, and business contracts have not been selected. Do not document planned integrations as operational.

## Branch and pull request workflow

- Never push directly to `main`, including corrective changes. Do not force-push `main`.
- Create a `codex/` feature branch before committing changes and submit changes through a pull request.
- Do not merge a pull request without explicit user authorization.

## Workflow and checks

Use Node 22+ and npm 10.9.3 with the committed lockfile. Install from the root with `npm ci`; use `npm install` when intentionally changing dependencies. Turborepo coordinates workspace tasks. All commands below run from the repository root:

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run contracts:build
npm run contracts:test
```

Run checks relevant to the change. Documentation-only changes require checking links, paths, examples, and command accuracy; they do not require a full application build. `npm test` discovers `packages/core/test/*.test.ts`, `packages/infrastructure/test/*.test.ts`, `packages/chain/test/*.test.ts` and `workers/api/test/*.test.ts`; extend test discovery if adding tests elsewhere. Foundry commands are separate from the web build and currently have no contracts to compile or test.

Never commit dependencies, build output, secrets, private keys, or local environment files. Keep changes scoped to the request and preserve unrelated work.

## Worktree deletion

- A sub-agent working in a worktree must never delete that worktree. Leave it intact and report its path to the parent.
- The main agent must ask for confirmation before removing a worktree that is its current working directory.
- From the repository root, the main agent may clean up only worktrees it created, never another agent's or user's worktree.
