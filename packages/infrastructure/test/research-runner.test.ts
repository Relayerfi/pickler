import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_CONFIG,
  createResearchRunner,
  PilotError,
  type ResearchModel,
  type Market,
  type Source,
  type Decision,
  type MarketData,
} from "@pickler/core";
import { SqliteResearchStore } from "../src/persistence/research-store";
const scope = { tenantId: "alpha", agentId: "pickle-alpha" };
const market: Market = {
  id: "1",
  question: "Test?",
  rules: "Resolve according to the official test source.",
  categoryIds: ["7"],
  active: true,
  closesAt: null,
  liquidity: 10,
  outcomes: [
    { id: "99", label: "Yes" },
    { id: "100", label: "No" },
  ],
};
const source: Source = {
  id: "source",
  url: "https://example.com",
  title: "Test evidence",
  content: "Test content",
  provider: "test",
  publishedAt: null,
  retrievedAt: new Date(100).toISOString(),
  truncated: false,
};
const decision: Decision = {
  action: "ABSTAIN",
  marketId: "1",
  outcomeId: null,
  thesis: "Evidence does not establish a result",
  counterEvidence: "Test source gives conflicting evidence",
  uncertainty: "Result unknown",
  sourceIds: ["source"],
  estimatedProbability: null,
  observedPrice: null,
  limitPrice: null,
  expiresAt: null,
  abstentionReason: "Insufficient evidence",
};
async function setup(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), "pickler-run-"));
  const repository = new SqliteResearchStore(`file:${join(dir, "test.db")}`);
  await repository.init();
  t.after(async () => {
    repository.close();
    await rm(dir, { recursive: true, force: true });
  });
  await repository.updateConfig(scope, 1, { ...DEFAULT_CONFIG, categoryIds: ["7"] });
  await repository.enqueue(scope, "test", null, 100);
  const run = (await repository.claim(101))!;
  const markets: MarketData = {
    categories: async () => [{ id: "7", label: "Test" }],
    list: async () => [market],
    get: async () => market,
    book: async (id) => ({
      outcomeId: id,
      observedAt: new Date(100).toISOString(),
      bids: [],
      asks: [{ price: "0.4", size: "2" }],
    }),
  };
  const model: ResearchModel = {
    metadata: () => ({ model: "test", provider: "test" }),
    select: async () => ({ marketId: "1", reason: "Researchable rules", usage: {} }),
    research: async ({ tools }) => {
      await tools.searchWeb!("supporting evidence", "supporting");
      await tools.searchWeb!("contrary evidence", "contradicting");
      return { decision: { ...decision }, usage: {} };
    },
  };
  const deps = {
    repository,
    markets,
    model,
    search: { search: async () => ({ sources: [source], usage: null }) },
    reader: { read: async () => source },
    now: () => 200,
  };
  return { ...deps, run, execute: () => createResearchRunner(deps)(run) };
}
test("decision and attributed evidence persist before completion", async (t) => {
  const f = await setup(t);
  await f.execute();
  const saved = await f.repository.run("alpha", f.run.id);

  assert.equal(saved.status, "completed");
  assert.equal(saved.decision?.action, "ABSTAIN");
  const events = await f.repository.events("alpha", f.run.id);

  assert.ok(events.some((e) => e.type === "sources"));
  assert.ok(events.some((e) => e.type === "selection"));
  assert.ok(events.some((e) => e.type === "market"));
});

test("live configuration changes block the next tool call and retain partial evidence", async (t) => {
  const f = await setup(t);
  let calls = 0;
  f.search.search = async () => {
    calls++;
    return { sources: [source], usage: null };
  };
  f.model.research = async ({ tools }) => {
    await tools.searchWeb!("first", "supporting");
    await f.repository.updateConfig(scope, 2, {
      ...f.run.config,
      tools: ["getMarketRules", "getOrderBook"],
    });
    await assert.rejects(tools.searchWeb!("second", "supporting"), { code: "CONFIG_CHANGED" });
    return { decision: { ...decision }, usage: {} };
  };
  await f.execute();

  assert.equal(calls, 1);
  assert.equal((await f.repository.run("alpha", f.run.id)).error, "CONFIG_CHANGED");
  assert.ok((await f.repository.events("alpha", f.run.id)).some((e) => e.type === "sources"));
});

test("disabled tool blocks work before external requests", async (t) => {
  const f = await setup(t);
  await f.repository.updateConfig(scope, 2, { ...f.run.config, tools: [] });
  let called = false;
  f.markets.list = async () => {
    called = true;
    return [market];
  };
  await f.execute();

  assert.equal(called, false);
  assert.equal((await f.repository.run("alpha", f.run.id)).status, "failed");
});

test("provider error cannot be turned into a valid abstention by the model", async (t) => {
  const f = await setup(t);
  f.search.search = async () => {
    throw new PilotError("PROVIDER_HTTP_429", "Test provider failure");
  };
  f.model.research = async ({ tools }) => {
    await tools.searchWeb!("test", "supporting").catch(() => {});
    return { decision: { ...decision }, usage: {} };
  };
  await f.execute();

  assert.equal((await f.repository.run("alpha", f.run.id)).error, "PROVIDER_FAILURE");
});

test("fabricated citations fail rather than entering the decision history", async (t) => {
  const f = await setup(t);
  f.model.research = async () => ({
    decision: { ...decision, sourceIds: ["invented"] },
    usage: {},
  });
  await f.execute();

  assert.equal((await f.repository.run("alpha", f.run.id)).error, "INVALID_DECISION");
});

test("trade proposal refreshes actual ask and abstains when it exceeds the limit", async (t) => {
  const f = await setup(t);
  let quotes = 0;
  f.markets.book = async (id) => {
    quotes++;
    return {
      outcomeId: id,
      observedAt: new Date(200).toISOString(),
      bids: [],
      asks: [{ price: "0.40000001", size: "2" }],
    };
  };
  f.model.research = async ({ tools }) => {
    await tools.searchWeb!("evidence", "supporting");
    await tools.searchWeb!("contrary evidence", "contradicting");
    return {
      decision: {
        ...decision,
        action: "TRADE",
        outcomeId: "99",
        estimatedProbability: 0.7,
        limitPrice: "0.4",
        observedPrice: "0.1",
        expiresAt: new Date(10000).toISOString(),
        abstentionReason: null,
      },
      usage: {},
    };
  };
  await f.execute();
  const saved = await f.repository.run("alpha", f.run.id);

  assert.equal(quotes, 3);
  assert.equal(saved.decision?.observedPrice, "0.40000001");
  assert.equal(saved.decision?.action, "ABSTAIN");
});

test("missing final quotation is an execution failure", async (t) => {
  const f = await setup(t);
  f.markets.book = async (id) => ({
    outcomeId: id,
    observedAt: new Date(200).toISOString(),
    bids: [],
    asks: [],
  });
  f.model.research = async ({ tools }) => {
    await tools.searchWeb!("evidence", "supporting");
    await tools.searchWeb!("contrary evidence", "contradicting");
    return {
      decision: {
        ...decision,
        action: "TRADE",
        outcomeId: "99",
        estimatedProbability: 0.7,
        limitPrice: "0.4",
        expiresAt: new Date(10000).toISOString(),
      },
      usage: {},
    };
  };
  await f.execute();

  assert.equal((await f.repository.run("alpha", f.run.id)).error, "NO_QUOTE");
});

test("tool quotas bound actual provider calls even if the model keeps asking", async (t) => {
  const f = await setup(t);
  let searches = 0,
    reads = 0;
  f.search.search = async () => {
    searches++;
    return { sources: [source], usage: null };
  };
  f.reader.read = async () => {
    reads++;
    return source;
  };
  f.model.research = async ({ tools }) => {
    await tools.searchWeb!("support", "supporting");
    await tools.searchWeb!("oppose", "contradicting");
    await tools.searchWeb!("follow-up", "supporting");
    await assert.rejects(tools.searchWeb!("over-budget", "supporting"), { code: "TOOL_LIMIT" });
    for (let i = 0; i < 5; i++) {
      await tools.readPage!(source.url);
    }
    await assert.rejects(tools.readPage!(source.url), { code: "TOOL_LIMIT" });
    return { decision: { ...decision }, usage: {} };
  };
  await f.execute();

  assert.equal(searches, 3);
  assert.equal(reads, 5);
});

test("a one-sided search cannot complete and market scope is checked before research", async (t) => {
  const f = await setup(t);
  f.model.research = async ({ tools }) => {
    await tools.searchWeb!("support", "supporting");
    return { decision: { ...decision }, usage: {} };
  };
  await f.execute();

  assert.equal((await f.repository.run("alpha", f.run.id)).error, "INCOMPLETE_RESEARCH");
  await f.repository.enqueue(scope, "outside", "2", 201);
  const outside = (await f.repository.claim(202))!;
  f.markets.get = async () => ({ ...market, id: "2", categoryIds: ["88"] });
  let called = false;
  f.model.research = async () => {
    called = true;
    return { decision, usage: {} };
  };
  await createResearchRunner(f)(outside);

  assert.equal(called, false);
  assert.equal((await f.repository.run("alpha", outside.id)).error, "MARKET_NOT_ALLOWED");
});
