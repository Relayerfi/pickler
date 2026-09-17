# Cloudflare runtime experiment

Read the root and agent-service instructions. This is a bounded compatibility probe, not a production API or replacement worker. Reuse the actual Mastra model adapter, capability adapters and core runner. Never silently substitute models or fabricate live evidence. Keep credentials in ignored local files or Cloudflare secrets.

Local full research uses an isolated PostgreSQL database and a request-scoped repository. The HTTP request remains open until completion; this does not establish safe detached execution or crash resumption. Do not run against the normal pilot database or introduce a background polling loop. Cloud deployment must require a dedicated probe token on every route and expose no Studio surface.

`client.mjs` prepares the isolated database and calls explicit probe endpoints. `/hold` is a no-provider process-interruption probe. `/research-ephemeral` is a remote runtime experiment with request-local evidence only; it is not a production repository or tenant API. Never present its output as remotely persisted.
