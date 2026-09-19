import { createApp } from "./app";
import { createServices } from "./container";
import type { Env } from "./env";
import { successEnvelope } from "./http/envelope";

// Preserve the legacy class and its stored data; staging does not bind it.
export { AgentLedger } from "./budget/agent-ledger";

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/health") {
      return Response.json(successEnvelope({ status: "ok" }, "/health"), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const services = createServices(env);
    try {
      return await createApp(services).fetch(request, env, ctx);
    } finally {
      await services.close();
    }
  },
} satisfies ExportedHandler<Env>;
