import { createResearchRunner, PilotError } from "@pickler/core";
import { ExaResearch, PolymarketData, PostgresResearchStore } from "@pickler/infrastructure";
import { decisionV2Schema } from "@pickler/api-schema";
import { runEphemeralResearch } from "./ephemeral-research";
import { createModel } from "../composition/model";
import type { Environment } from "../config/env";

type Bindings = Environment & { PROBE_TOKEN: string };

const probe = {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    if (!env.PROBE_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.PROBE_TOKEN}`) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health") {
      return Response.json({ runtime: "cloudflare-workers", model: env.MODEL_ID });
    }
    if (request.method !== "POST") {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    try {
      const model = createModel(env);
      if (path === "/research-ephemeral") {
        return Response.json(await runEphemeralResearch(env, request.signal));
      }
      if (path === "/check") {
        return Response.json(await model.check());
      }
      if (path !== "/research" && path !== "/interrupt" && path !== "/hold") {
        return Response.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      // An operator-created isolated database is mandatory. Never recover live pilot jobs.
      if (!new URL(env.DATABASE_URL).pathname.startsWith("/pickler_cf_probe_")) {
        return Response.json({ error: "ISOLATED_DATABASE_REQUIRED" }, { status: 400 });
      }
      const repository = new PostgresResearchStore(env.DATABASE_URL);
      let release: (() => Promise<void>) | undefined;
      try {
        const controller = new AbortController();
        release = await repository.acquireWorker(() => controller.abort());
        await repository.recover(Date.now());
        const scope = { tenantId: "beta", agentId: "pickle-beta" };
        const queued = await repository.enqueue(scope, crypto.randomUUID(), null, Date.now());
        const run = await repository.claim(Date.now());
        if (!run || run.id !== queued.id) {
          throw new PilotError("PROBE_CLAIM_FAILED", "Unexpected pending job");
        }
        if (path === "/hold") {
          await repository.event(run, "probe_wait", { providerCalls: false }, Date.now());
          await new Promise((resolve) => setTimeout(resolve, 60_000));
          await repository.finish(run, null, "PROBE_HOLD_ENDED", Date.now());
          return Response.json({ run: await repository.run(scope.tenantId, run.id) });
        }
        const search = new ExaResearch(env.EXA_API_KEY);
        if (path === "/interrupt") {
          controller.abort();
        }
        const execute = createResearchRunner({
          repository,
          model,
          search,
          reader: search,
          markets: new PolymarketData(),
        });
        await execute(run, AbortSignal.any([controller.signal, request.signal]));
        const saved = await repository.run(scope.tenantId, run.id);
        if (saved.status === "completed") {
          decisionV2Schema.parse(saved.decision);
        }
        return Response.json({
          run: saved,
          events: await repository.events(scope.tenantId, run.id),
        });
      } finally {
        await release?.();
        await repository.close();
      }
    } catch (error) {
      return Response.json(
        { error: error instanceof PilotError ? error.code : "PROBE_FAILED" },
        { status: 500 },
      );
    }
  },
};

export default probe;
