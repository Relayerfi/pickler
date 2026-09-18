import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DEFAULT_CONFIG,
  evaluateDecision,
  validateReport,
  type Source,
  type Market,
} from "@pickler/core";
import { readEnv } from "./config/env";
import { createModel } from "./composition/model";
import { nflEvaluationCases } from "./evaluation/nfl-fixtures";

if (process.argv[2] !== "--all-six") {
  throw new Error(
    "Explicit paid evaluation: use --all-six. Six synthetic cases, no external services, no automatic retries.",
  );
}
const directory = resolve(".data/nfl-evaluation-v1");
await mkdir(directory, { recursive: true });
const model = createModel(readEnv());
for (const fixture of nflEvaluationCases) {
  const path = resolve(directory, `${fixture.id}.json`);
  try {
    await readFile(path);
    throw new Error(
      `Case ${fixture.id} already attempted. Review the recorded result; automatic repetition is forbidden.`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  await writeFile(path, JSON.stringify({ id: fixture.id, status: "started", synthetic: true }), {
    flag: "wx",
    mode: 0o600,
  });
  const source: Source = {
    id: `fixture:${fixture.id}`,
    url: `https://example.com/fixtures/${fixture.id}`,
    title: "Synthetic frozen NFL evidence",
    provider: "fixture",
    content: fixture.facts,
    retrievedAt: "2026-09-17T12:00:00Z",
    publishedAt: "2026-09-17T12:00:00Z",
    truncated: false,
  };
  const market: Market = {
    id: "1",
    question: "NFL Detroit Lions vs. Buffalo Bills",
    rules: "Synthetic full-game-winner fixture, including overtime. No real market or orders.",
    active: true,
    startsAt: "2026-09-18T00:15:00Z",
    closesAt: "2026-09-18T04:00:00Z",
    categoryIds: ["1"],
    liquidity: 100,
    outcomes: [
      { id: "2", label: "Detroit Lions" },
      { id: "3", label: "Buffalo Bills" },
    ],
  };
  const quote = {
    outcomeId: "2",
    observedAt: new Date().toISOString(),
    asks: [{ price: "0.40", size: "100" }],
    bids: [],
  };
  const started = Date.now();
  const usage: unknown[] = [];
  const diagnostics: unknown[] = [];
  try {
    const result = await model.research({
      protocol: "nfl-winner-v1",
      market,
      profile: "Evaluate the synthetic fixture honestly. Do not invent evidence.",
      availability: { balldontlie: "disabled", "the-odds-api": "disabled" },
      limits: DEFAULT_CONFIG.limits,
      selectionSteps: 0,
      signal: AbortSignal.timeout(300000),
      onUsage: async (entry) => {
        usage.push(entry);
      },
      onDiagnostic: async (entry) => {
        diagnostics.push(entry);
      },
      evidence: () => ({ sources: [source], quotes: [quote] }),
      tools: {
        searchWeb: async () => [source],
        getMarketRules: async () => market,
        getOrderBook: async () => quote,
      },
    });
    await writeFile(
      path,
      JSON.stringify({
        synthetic: true,
        id: fixture.id,
        status: "validating",
        assessment: result.decision,
        usage,
        diagnostics,
      }),
      { mode: 0o600 },
    );
    validateReport(result.decision, market, [source]);
    const evaluated = evaluateDecision(
      result.decision,
      result.decision.action === "TRADE" ? "0.40" : null,
      undefined,
      Date.now(),
    );
    await writeFile(
      path,
      JSON.stringify(
        {
          synthetic: true,
          id: fixture.id,
          expected: fixture.expected,
          matches: evaluated.action === fixture.expected,
          elapsedMs: Date.now() - started,
          usage: result.usage,
          decision: evaluated,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        id: fixture.id,
        action: evaluated.action,
        matches: evaluated.action === fixture.expected,
      }),
    );
  } catch (error) {
    await writeFile(
      path,
      JSON.stringify({
        synthetic: true,
        id: fixture.id,
        status: "failed",
        usage,
        diagnostics,
        code:
          typeof error === "object" && error && "code" in error ? error.code : "EVALUATION_FAILED",
        elapsedMs: Date.now() - started,
      }),
      { mode: 0o600 },
    );
    throw new Error(`Evaluation ${fixture.id} failed; acceptance remains pending. No retry.`);
  }
}
