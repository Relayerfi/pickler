# Background queue experiment

Read the root, agent-service and parent Cloudflare instructions. This local-only experiment extends the retained HTTP probe without changing its deployment. Use an isolated loopback PostgreSQL database named `pickler_cf_queue_*`.

Reuse the tenant API and research runner. PostgreSQL queued records are the durable pending-work source; Cloudflare Queue messages are wakeups, never tenant authority. Await research in the queue handler, never detach it from an HTTP request. Acquire the global database worker lock before recovery or claims. Preserve queued jobs; interrupted running jobs fail without automatic paid retries. Keep one active research worker. Cron reconciles pending work and due schedules. Local Cron events must be triggered explicitly in Wrangler.

No paid calls at startup. Do not deploy this configuration or upload database/tenant secrets. Tests may inject execution fixtures, but runtime must use real providers. Always close request-scoped database pools, even if releasing ownership fails.
