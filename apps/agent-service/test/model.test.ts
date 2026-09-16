import { test } from "node:test";
import assert from "node:assert/strict";
import { createModel } from "../src/composition/model";
import { readEnv } from "../src/config/env";
const env = readEnv({
  MODEL_BASE_URL: "https://model.example/v1",
  MODEL_ID: "explicit-test-model",
  MODEL_API_KEY: "test-only",
  EXA_API_KEY: "test-only",
  TENANT_ALPHA_TOKEN: "a".repeat(32),
  TENANT_BETA_TOKEN: "b".repeat(32),
});

const sample = {
  action: "ABSTAIN",
  marketId: "connectivity-check",
  outcomeId: null,
  thesis: "Connection validation only",
  counterEvidence: "Connection validation only",
  uncertainty: "Connection validation only",
  sourceIds: ["connectivity-check"],
  estimatedProbability: null,
  observedPrice: null,
  limitPrice: null,
  expiresAt: null,
  abstentionReason: "Connection validation only",
};
test("configured OpenAI-compatible model executes a real Mastra tool loop and structured output using an offline transport fixture", async (t) => {
  const calls: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push(request);
    assert.equal(request.model, "explicit-test-model");
    assert.ok(Number(request.max_tokens ?? request.max_completion_tokens) <= 2000);
    const tool = calls.length === 1;
    const message = tool
      ? {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call-probe",
              type: "function",
              function: { name: "connectionProbe", arguments: '{"value":"pickler"}' },
            },
          ],
        }
      : { role: "assistant", content: JSON.stringify(sample) };
    if (!request.stream) {
      return Response.json({
        id: "test",
        object: "chat.completion",
        created: 1,
        model: "explicit-test-model",
        choices: [{ index: 0, message, finish_reason: tool ? "tool_calls" : "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });
    }
    const delta = tool
      ? { ...message, tool_calls: [{ index: 0, ...message.tool_calls![0] }] }
      : message;
    const chunk = {
      id: "test",
      object: "chat.completion.chunk",
      created: 1,
      model: "explicit-test-model",
      choices: [{ index: 0, delta, finish_reason: null }],
    };
    const end = {
      ...chunk,
      choices: [{ index: 0, delta: {}, finish_reason: tool ? "tool_calls" : "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    };
    return new Response(
      `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  const result = (await createModel(env).check()) as {
    toolCall: boolean;
    structuredDecision: boolean;
  };

  assert.equal(result.toolCall, true);
  assert.equal(result.structuredDecision, true);
  assert.equal(calls.length, 2);
});

test("missing configuration fails without a default model or token reuse", () => {
  assert.throws(() => readEnv({}), /MODEL_BASE_URL/);
  assert.throws(() => readEnv({ ...env, TENANT_BETA_TOKEN: env.TENANT_ALPHA_TOKEN }), /distinct/);
});

test("research combines tool calls, per-step usage and validated decisions in Mastra", async (t) => {
  let calls = 0,
    usageSteps = 0;
  const intents: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls++;
    const tool = calls <= 2;
    const toolCalls = [
      {
        index: 0,
        id: `call-${calls}`,
        type: "function",
        function: {
          name: "searchWeb",
          arguments: JSON.stringify({
            query: calls === 1 ? "evidence supporting" : "evidence contradicting",
            intent: calls === 1 ? "supporting" : "contradicting",
          }),
        },
      },
    ];
    const message = tool
      ? { role: "assistant", content: null, tool_calls: toolCalls }
      : {
          role: "assistant",
          content: JSON.stringify({ ...sample, marketId: "1", sourceIds: ["source"] }),
        };
    const reason = tool ? "tool_calls" : "stop";
    const usage = { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 };
    if (!request.stream) {
      return Response.json({
        id: "research",
        object: "chat.completion",
        created: 1,
        model: env.MODEL_ID,
        choices: [{ index: 0, message, finish_reason: reason }],
        usage,
      });
    }
    const base = {
      id: "research",
      object: "chat.completion.chunk",
      created: 1,
      model: env.MODEL_ID,
    };
    return new Response(
      `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: message, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: reason }], usage })}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  const result = await createModel(env).research({
    market: {
      id: "1",
      question: "Test",
      rules: "Test rules",
      categoryIds: ["2"],
      active: true,
      closesAt: null,
      liquidity: 1,
      outcomes: [
        { id: "99", label: "Yes" },
        { id: "100", label: "No" },
      ],
    },
    profile: "Research both directions",
    signal: AbortSignal.timeout(5000),
    limits: {
      searches: 3,
      pageReads: 5,
      steps: 12,
      durationMs: 300000,
      outputTokens: 2000,
      dailyRuns: 6,
    },
    onUsage: async () => {
      usageSteps++;
    },
    tools: {
      searchWeb: async (_query, intent) => {
        intents.push(intent);
        return [
          {
            id: "source",
            url: "https://example.com",
            title: "Fixture",
            content: "Fixture evidence",
            retrievedAt: new Date().toISOString(),
            publishedAt: null,
            provider: "fixture",
            truncated: false,
          },
        ];
      },
    },
  });
  assert.deepEqual(intents, ["supporting", "contradicting"]);
  assert.equal(result.decision.action, "ABSTAIN");
  assert.equal(calls, 3);
  assert.equal(usageSteps, 3);
});
