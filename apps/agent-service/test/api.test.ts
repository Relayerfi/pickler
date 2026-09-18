import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestStore } from "@pickler/infrastructure/testing";
import { DEFAULT_CONFIG, type MarketData } from "@pickler/core";
import { createApi } from "../src/api/app";
import { buildTools } from "../src/plugins/registry";
import { decisionSchema } from "@pickler/api-schema";

test("HTTP authorization, scoped writes, async run dispatch and polling", async (t) => {
  const repository = await createTestStore(t);
  const unavailable = async () => {
    throw new Error("Not used in this test");
  };
  const markets: MarketData = {
    categories: async () => [],
    list: unavailable,
    get: unavailable,
    book: unavailable,
  };
  const app = createApi({
    repository,
    markets,
    tokens: { alpha: "a".repeat(32), beta: "b".repeat(32) },
    checkConnections: unavailable,
  });
  const request = (path: string, tenant = "a", method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        Authorization: `Bearer ${tenant.repeat(32)}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "test-key",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal((await app.request("/agents")).status, 401);
  assert.equal((await request("/agents/pickle-alpha", "b")).status, 404);
  const update = { expectedVersion: 1, config: { ...DEFAULT_CONFIG, categoryIds: ["7"] } };

  assert.equal((await request("/agents/pickle-alpha/config", "b", "PUT", update)).status, 404);
  assert.equal(
    (await request("/agents/pickle-alpha/config", "a", "PUT", { ...update, tenantId: "beta" }))
      .status,
    400,
  );
  assert.equal((await request("/agents/pickle-alpha/config", "a", "PUT", update)).status, 200);
  const response = await request("/agents/pickle-alpha/runs", "a", "POST", {});

  assert.equal(response.status, 202);
  const run = (await response.json()) as { runId: string };

  assert.equal((await request(`/runs/${run.runId}`, "b")).status, 404);
  assert.equal((await request(`/runs/${run.runId}/events`, "b")).status, 404);
  assert.equal((await request(`/runs/${run.runId}`)).status, 200);
  assert.equal(
    (await request("/agents/pickle-alpha/pause", "b", "PUT", { paused: true })).status,
    404,
  );
});

test("closed tool registry omits disabled capabilities and validates output", async () => {
  assert.deepEqual(Object.keys(buildTools({})), []);
  const tools = buildTools({ searchWeb: async () => [{ id: "bad" } as never] });
  const invalid = await tools.searchWeb!.inputSchema!["~standard"].validate({
    query: "",
    tenantId: "beta",
  });
  assert.ok(invalid.issues?.length);
  await assert.rejects(async () =>
    tools.searchWeb!.execute!({ query: "test", intent: "supporting" }, {} as never),
  );
  assert.equal(decisionSchema.safeParse({ action: "TRADE", size: "100" }).success, false);
});

test("paper transport authenticates tenant and rejects executable sizes or tenant overrides", async (t) => {
  const repository = await createTestStore(t);
  const unavailable = async () => {
    throw new Error("Not used");
  };
  let calls = 0;
  const app = createApi({
    repository,
    markets: { categories: async () => [], list: unavailable, get: unavailable, book: unavailable },
    tokens: { alpha: "a".repeat(32) },
    checkConnections: unavailable,
    paper: {
      get: unavailable,
      create: async (tenantId, runId, key) => {
        calls++;
        assert.equal(tenantId, "alpha");
        assert.equal(key, "paper-key");
        return {
          id: "paper",
          tenantId,
          agentId: "pickle-alpha",
          runId,
          marketId: "1",
          outcomeId: "2",
          status: "pending",
          virtualBudget: "10",
          createdAt: 1,
          finishedAt: null,
          reason: null,
          fill: null,
        };
      },
    },
  });
  const request = (body: unknown) =>
    app.request("/runs/fixture/paper-order", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${"a".repeat(32)}`,
        "Idempotency-Key": "paper-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal((await app.request("/runs/fixture/paper-order", { method: "POST" })).status, 401);
  assert.equal((await request({ size: "100" })).status, 400);
  assert.equal((await request({ tenantId: "beta" })).status, 400);
  assert.equal(calls, 0);
  assert.equal((await request({})).status, 202);
  assert.equal(calls, 1);
});
