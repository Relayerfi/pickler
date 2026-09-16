import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { decisionSchema } from "@pickler/api-schema";
import { PilotError, type ResearchModel, type Market } from "@pickler/core";
import { buildTools } from "../plugins/registry";
import type { Environment } from "../config/env";
import { researchSystemPrompt } from "../prompts/research-system";
import {
  marketSelectionSystemPrompt,
  marketSelectionSchema,
} from "../prompts/market-selection-system";

export function createModel(env: Environment): ResearchModel & { check(): Promise<unknown> } {
  const provider = createOpenAICompatible({
    name: "pickler-configured",
    baseURL: env.MODEL_BASE_URL,
    apiKey: env.MODEL_API_KEY,
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        signal: AbortSignal.any([
          ...(init?.signal ? [init.signal] : []),
          AbortSignal.timeout(60_000),
        ]),
      }),
  });
  const model = provider.chatModel(env.MODEL_ID);
  const settings = { maxOutputTokens: 2000 };
  return {
    metadata: () => ({
      model: env.MODEL_ID,
      provider: new URL(env.MODEL_BASE_URL).origin,
      prompts: { research: researchSystemPrompt, marketSelection: marketSelectionSystemPrompt },
    }),
    async select(markets: Market[], profile: string, signal: AbortSignal, limits) {
      const agent = new Agent({
        maxRetries: 0,
        id: "market-selector",
        name: "Market selector",
        instructions: marketSelectionSystemPrompt.instructions,
        model,
      });
      const schema = marketSelectionSchema;
      const result = await agent.generate(
        JSON.stringify({
          profile,
          candidates: markets.map(({ id, question, liquidity, closesAt }) => ({
            id,
            question,
            liquidity,
            closesAt,
          })),
        }),
        {
          maxSteps: 1,
          abortSignal: signal,
          modelSettings: { maxOutputTokens: limits.outputTokens },
          structuredOutput: { schema },
        },
      );
      return { ...schema.parse(result.object), usage: result.totalUsage };
    },
    async research(input) {
      const agent = new Agent({
        maxRetries: 0,
        id: "researcher",
        name: "Pickler researcher",
        instructions: researchSystemPrompt.instructions,
        model,
        tools: buildTools(input.tools),
      });
      const result = await agent.generate(
        JSON.stringify({
          now: new Date().toISOString(),
          market: input.market,
          profile: input.profile,
        }),
        {
          maxSteps: input.limits.steps - 1,
          abortSignal: input.signal,
          modelSettings: { maxOutputTokens: input.limits.outputTokens },
          onStepFinish: async (step) => {
            await input.onUsage(step.usage);
          },
          structuredOutput: { schema: decisionSchema },
          toolCallConcurrency: 1,
        },
      );
      return { decision: decisionSchema.parse(result.object), usage: result.totalUsage };
    },
    async check() {
      let called = false;
      const echo = createTool({
        id: "connectionProbe",
        description: "Required connection probe. Call with value pickler.",
        inputSchema: z.object({ value: z.literal("pickler") }),
        outputSchema: z.object({ ok: z.literal(true) }),
        execute: async () => {
          called = true;
          return { ok: true as const };
        },
      });
      const agent = new Agent({
        maxRetries: 0,
        id: "connection-check",
        name: "Connection check",
        instructions: "Follow the probe instruction exactly.",
        model,
        tools: { connectionProbe: echo },
      });
      const probe = await agent.generate("Call connectionProbe with value pickler.", {
        maxSteps: 1,
        toolChoice: "required",
        modelSettings: settings,
      });
      if (!called) {
        throw new PilotError(
          "MODEL_TOOL_CHECK_FAILED",
          "Configured model did not invoke the probe",
        );
      }
      const structured = await new Agent({
        maxRetries: 0,
        id: "schema-check",
        name: "Schema check",
        instructions: `Return the requested structured sample as JSON; this is a connectivity fixture, not market research. The JSON response must satisfy this schema exactly: ${JSON.stringify(z.toJSONSchema(decisionSchema))}`,
        model,
      }).generate(
        "Return an ABSTAIN decision for market connectivity-check, sourceIds [connectivity-check], all nullable fields null except abstentionReason Connection validation only. Explain thesis, counterEvidence and uncertainty as Connection validation only.",
        { maxSteps: 1, modelSettings: settings, structuredOutput: { schema: decisionSchema } },
      );
      decisionSchema.parse(structured.object);
      return {
        model: env.MODEL_ID,
        toolCall: true,
        structuredDecision: true,
        usage: [probe.totalUsage, structured.totalUsage],
      };
    },
  };
}
