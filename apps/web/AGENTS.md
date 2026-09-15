# Web app instructions

Read [the root instructions](../../AGENTS.md) first. Before changing a dependency, read that package's own `AGENTS.md`. Keep this file current when app structure, server boundaries, commands, or conventions change.

## Responsibility and current state

`@pickler/web` is the Next.js App Router application. It owns presentation, HTTP transport, and the server composition root. Business logic and provider implementations live in separate workspace packages so the backend can later move to `apps/api`.

The current app contains a landing page, a shared `Button`, and `GET /api/v1/health`. The endpoint calls an injected system clock through a use case. It is a liveness check, not a check of databases or external services. Authentication, persistence, providers, and wallet functionality are not implemented.

```text
src/
  app/
    layout.tsx                 # Root layout and global/shared styles
    page.tsx                   # Server Component landing page
    globals.css                # Application-specific styles
    api/v1/health/route.ts      # HTTP presentation adapter
  server/
    container.ts               # Protected composition root
```

## Three-layer rules

| Layer | Location | Owns | Must not own |
| --- | --- | --- | --- |
| Presentation | `src/app`, future `src/components` and `src/features` | Pages, UI state, input parsing, authentication at the transport boundary, HTTP mapping | Business decisions, database queries, provider SDK calls |
| Business | `packages/core/src` | Domain rules, use cases, authorization decisions, dependency interfaces | Next.js, React, HTTP objects, ORM/provider SDKs |
| Infrastructure | `packages/infrastructure/src` | Repositories, provider/RPC adapters, technical error translation | HTTP responses, React components, product policy |

`src/server/container.ts` is the composition root, not an additional business layer. It imports use-case factories and concrete adapters, wires them together, and exposes callable services. Its `server-only` import prevents client consumption. Any additional server facade or module that accesses credentials must also be protected with `server-only`.

Presentation must obtain services through `@/server/container` or a protected server facade. Do not directly import `@pickler/core` or `@pickler/infrastructure` from pages, components, or Route Handlers; the current ESLint configuration rejects these imports outside `src/server`. Do not bypass this restriction with relative cross-package paths or new re-export barrels.

Execution flows from handler to use case to adapter. Source dependencies point toward business: presentation → business ← infrastructure. The business layer owns each port; infrastructure implements it.

## Working example: health across all three layers

The snippets below describe the existing implementation. Read their actual source files before modifying them.

**1. Business port — `packages/core/src/ports/clock.ts`:**

```ts
export interface Clock {
  now(): Date;
}
```

**2. Use case — `packages/core/src/application/get-health.ts`:**

```ts
import type { Clock } from "../ports/clock.js";

export function createGetHealth(clock: Clock) {
  return () => ({ status: "ok" as const, checkedAt: clock.now() });
}
```

The use case receives an interface. It does not instantiate adapters or import Next.js.

**3. Infrastructure adapter — `packages/infrastructure/src/index.ts`:**

```ts
import type { Clock } from "@pickler/core";

export const systemClock: Clock = {
  now: () => new Date(),
};
```

**4. Composition — `src/server/container.ts`:**

```ts
import "server-only";
import { createGetHealth } from "@pickler/core";
import { systemClock } from "@pickler/infrastructure";

// Composition root: wire concrete adapters here, not inside business logic.
export const services = {
  getHealth: createGetHealth(systemClock),
};
```

**5. Presentation — `src/app/api/v1/health/route.ts`:**

```ts
import type { HealthResponse } from "@pickler/api-schema";
import { services } from "@/server/container";

export const runtime = "nodejs";

export function GET() {
  const health = services.getHealth();
  const body: HealthResponse = {
    status: health.status,
    checkedAt: health.checkedAt.toISOString(),
  };
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
```

The handler converts the internal `Date` to the public ISO string DTO. HTTP status, headers, serialization, and transport validation belong here or in shared HTTP helpers. This read-only endpoint has no inputs or authorization requirement; it is not a template for omitting those checks on business operations.

## Folder example for a new business feature

The following `bookings` feature is illustrative; it is not implemented and does not imply a selected database or provider. Create only the files a real feature needs.

```text
apps/web/src/
  app/
    bookings/page.tsx                        # Server-rendered presentation
    api/v1/bookings/route.ts                 # GET/POST transport adapters
  features/bookings/
    components/booking-form.tsx              # Client Component when interactive
  server/
    container.ts                            # Wire repositories into use cases
    http/
      errors.ts                             # Safe error-to-status mapping
      parse-create-booking.ts               # Runtime request validation
    auth/
      require-actor.ts                      # Resolve verified identity
packages/core/src/features/bookings/
  domain/
    booking.ts                              # Entities and invariants
    errors.ts                               # Domain-specific failures
  application/
    create-booking.ts                       # Authorization and orchestration
  ports/
    booking-repository.ts                   # Persistence interface
packages/infrastructure/src/bookings/
  booking-repository.ts                     # Actual provider implementation
packages/api-schema/src/bookings.ts          # Public request/response DTOs
packages/core/test/create-booking.test.ts    # Use-case and rule tests
```

Export new public functionality through each package's declared entry points and declare new workspace dependencies. Do not import another package's internal file directly. Keep request validation and response mapping out of core, and keep domain invariants out of the form and Route Handler. Client-side validation may improve UX but never replaces server validation.

## How to implement a feature

1. Define the operation, business invariants, and permissions. Put entities, domain errors, use cases, and ports in core. Pass plain inputs and a verified actor into use cases; never accept `NextRequest`, cookies, framework sessions, or an identity trusted from the request body.
2. Add tests for the rules and authorization behavior, including rejection paths. Use test doubles for ports in tests only. A use case must be testable without starting Next.js or contacting a provider.
3. Implement required ports in infrastructure. Keep SDK types inside the adapter. Validate external responses and translate failures into errors understood by core. Do not instantiate provider clients inside the use case.
4. Wire dependencies in the protected server composition root. Keep per-request identity and mutable request state out of module-level shared services.
5. Define public DTOs in `api-schema`. Validate untrusted HTTP input at runtime before calling a use case; TypeScript interfaces are not validators. Serialize dates and large integers deliberately rather than exposing internal objects.
6. Implement a thin Route Handler: parse and validate input, obtain verified identity, invoke the service, map output, and translate known failures. Return safe errors for unexpected failures and log diagnostic details only on the server. Set a caching policy appropriate to the data.
7. Add the UI. Prefer a Server Component calling a protected server facade directly for server-side reads. Use `/api/v1/*` from Client Components or external consumers. Do not make server-to-self HTTP requests just to reuse a handler.
8. Run relevant checks and update the affected projects' `AGENTS.md` files. If test files move outside the root test script's current glob, update discovery explicitly.

## Next.js and security conventions

- Use named HTTP method exports in `route.ts`, App Router, and the Node.js runtime. Keep route-specific transport behavior inside the app.
- Keep components server-rendered by default. Add `"use client"` only at interactive boundaries. Never import server facades or infrastructure into Client Components.
- Follow the installed Next.js version's asynchronous request APIs: await dynamic params, `cookies()`, and `headers()` when using them.
- Authenticate at the transport boundary; enforce business permissions in the use case. Treat Server Actions, if introduced, as public entry points with the same validation and authorization requirements.
- Keep credentials server-side. `NEXT_PUBLIC_*` values are public. Never expose provider credentials, private keys, or internal errors to the browser.
- Do not share authenticated or user-specific responses in a public cache. Choose caching and invalidation for each data flow explicitly.
- Keep long-running jobs, event indexing, and transaction confirmation loops outside the request lifecycle when those features are introduced.
- Wallet signing belongs at the client wallet boundary. Server-side blockchain reads belong in infrastructure behind business ports; public ABIs and deployment metadata belong in `packages/chain`.
- Put reusable, product-independent components in `packages/ui`; keep booking forms, wallet connection flows, and other product-specific UI in this app.

## Commands and validation

Run from the repository root:

```sh
npm run dev
npm run typecheck --workspace=@pickler/web
npm run lint
npm test
npm run build
```

Use root `npm run build` and `npm run typecheck` when validating changes across packages. For behavior changes, verify affected HTTP methods, runtime input rejection, safe failures, caching, and the UI flow as applicable. The existing health test covers core behavior only; it is not an end-to-end test suite.

## Planned agent pilot

The [agent runtime V1](../../docs/specs/agent-runtime-v1.md) has a research-only pilot in the separate `apps/agent-service` host. See its README for the current laboratory API. Future web routes act as authenticated facades: verify workspace access, forward trusted scope server-to-server, and expose safe run status/events. Keep Mastra runtime and worker code out of the frontend. The proposed routes are not implemented; the specification lets frontend work proceed independently.
