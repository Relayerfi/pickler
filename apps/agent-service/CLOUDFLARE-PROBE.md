# Mastra on Cloudflare Workers: compatibility probe

This experiment reuses the existing Mastra model adapter, tools, prompts, provider adapters and core research runner. It is not a production API, scheduler or durable execution implementation. No Container or Cloudflare Workflow is used.

## Verified locally on 2026-09-17

Wrangler 4.133.0 bundles and runs the service in **workerd**, not a Node.js HTTP server. With Node compatibility, the deployed bundle was approximately 2,025 KiB compressed. Cloudflare accepted deployment and reported 276 ms Worker startup time; this is not end-to-end request latency.

An actual workerd investigation with the configured DashScope model, Exa and Polymarket completed in approximately 70 seconds:

- Run: `91e02cbe-6820-4e80-b7b2-c92163ac2a28`.
- Market: whether Vinicius Junior wins the 2026 Ballon d'Or.
- Result: valid decision v2, `ABSTAIN`.
- Three real Exa searches; all 12 cited IDs occur in retrieved sources.
- PostgreSQL readback matches the HTTP result; alpha cannot read beta's run.
- Reported research usage: 52,345 input and 8,070 output tokens, including 5,949 reasoning tokens. Reasoning is not added again to output. Selection usage is separate.
- Actual process termination was tested with a no-provider held job (`049d9513-2b0a-485d-906c-4a96db13939c`): after workerd restarted, recovery marked it `failed/INTERRUPTED` and preserved its `probe_wait` event. It did not resume.
- A pre-aborted invocation persisted `failed/DEADLINE_OR_CANCELLED` and its runtime snapshot without provider calls.

The probe database is separate from the ordinary pilot. Its records and ignored response files are retained for inspection. These results do not establish a hosted Supabase connection, production quotas/concurrency, durable restart/resumption, or profitability.

## Compatibility correction

The first workerd attempt failed before discovery: Workers rejects Fetch `redirect: "error"`. Provider HTTP calls now use `manual` and reject non-success HTTP responses, including redirects. A regression test verifies redirects are not followed. The failed run is preserved as `8304f6a4-07a5-4ec5-b459-4f5cbdd0d700`; no model call occurred.

The runner's repository dependency is narrowed to the three methods it actually consumes: `agent`, `event`, `finish`. Production admission and ownership checks remain in their existing host. This allows a clearly labeled, ephemeral remote experiment without pretending that request-local evidence is persisted remotely.

## Reproduce locally

Use the repository's supported Node version. From the repository root:

```sh
npm run build:shared
node apps/agent-service/src/cloudflare/client.mjs prepare
npx wrangler dev --config apps/agent-service/wrangler.probe.jsonc --ip 127.0.0.1 --port 8797 --inspector-port 9247
```

Preparation reads the existing ignored agent-service `.env`, requires a local PostgreSQL connection with database-creation permission, creates a unique `pickler_cf_probe_*` database, applies migrations and configures Sports for its beta preset. It writes a dedicated random probe token and required provider variables to ignored `.dev.vars` and `.data/cf-probe.json`. It refuses to overwrite existing files. It does not call providers or change the ordinary pilot database.

From another terminal:

```sh
node apps/agent-service/src/cloudflare/client.mjs health
node apps/agent-service/src/cloudflare/client.mjs interrupt
# Explicit live provider calls and associated costs:
node apps/agent-service/src/cloudflare/client.mjs check
node apps/agent-service/src/cloudflare/client.mjs research
```

The client saves full responses under ignored `.data/` and prints only a summary. Each research request starts a new run. Do not automatically retry ambiguous requests. Keep the HTTP request open until the result arrives. This probe deliberately does not return 202 and continue with `waitUntil()`.

To reproduce process interruption without paid calls, start `node apps/agent-service/src/cloudflare/client.mjs hold`, wait for its `probe_wait` event in the isolated database, stop workerd, restart it and invoke `interrupt`. The held run must become `INTERRUPTED` with its event preserved. This test endpoint never contacts providers.

## Remote experiment boundary

`wrangler.probe.jsonc` defines the dedicated temporary Worker `pickler-mastra-runtime-probe`. Every endpoint requires `Authorization: Bearer PROBE_TOKEN`; no Studio or tenant-token API is exposed. Missing authentication returns 401. Provider calls never happen at startup.

A remote `/research-ephemeral` request executes the same core runner with real providers and request-local records. It returns all evidence to the caller but **does not persist it remotely**, enforce production tenant admission, or recover interrupted requests. This endpoint is only suitable for a temporary operator-controlled compatibility test. `/research` and `/interrupt` instead require the isolated PostgreSQL connection; local PostgreSQL cannot be reached from the deployed Worker.

Before remote provider calls, obtain explicit authorization to put `MODEL_API_KEY` and `EXA_API_KEY` into the temporary Worker's secrets. Prepare an ignored `.data/cf-remote-secrets.json` containing only `MODEL_BASE_URL`, `MODEL_ID`, `MODEL_API_KEY`, `EXA_API_KEY`, and a fresh `PROBE_TOKEN`. Never upload database URLs or the pilot's tenant tokens for the ephemeral test.

```sh
npx wrangler deploy --config apps/agent-service/wrangler.probe.jsonc
npx wrangler secret bulk apps/agent-service/.data/cf-remote-secrets.json --config apps/agent-service/wrangler.probe.jsonc
PROBE_BASE_URL=https://YOUR-PROBE.YOUR-SUBDOMAIN.workers.dev node apps/agent-service/src/cloudflare/client.mjs research-ephemeral
# Remove the temporary Worker and its secrets after verification:
npx wrangler delete --config apps/agent-service/wrangler.probe.jsonc
```

Cloudflare deployment succeeded and its unauthenticated endpoint returned HTTP 401. Real remote provider calls remain pending explicit secret-upload authorization. This is separate from the completed local workerd investigation. Do not treat a successful bundle or deployment as a successful remote provider run.

## What remains before production

- Choose a background execution mechanism with an explicit lifetime. An HTTP response does not make subsequent research durable.
- Replace the process-wide session ownership/recovery model before allowing independent concurrent executors. Current restart recovery marks running jobs interrupted; it does not resume a model loop.
- Verify PostgreSQL connectivity in the remote environment. The existing session advisory lock requires direct/session connections, not transaction pooling through Hyperdrive.
- Preserve tenant authorization, permission rechecks, quotas and idempotency in the production entry point; the ephemeral probe is not a replacement.
- Extend the bounded process-interruption probe to ambiguous provider responses, retry policy and load. Never blindly repeat paid model calls after an uncertain failure.
- Keep Studio privileged and separate from the public API.

References: [Workers Fetch](https://developers.cloudflare.com/workers/runtime-apis/fetch/), [Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [HTTP background lifetime](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil), [Hyperdrive transaction pooling](https://developers.cloudflare.com/hyperdrive/concepts/connection-pooling/).
