import { ModelFailure, PilotError, type ModelFailureDetails } from "@pickler/core";
import type { z } from "zod";

type ModelOutput = {
  object?: unknown;
  finishReason?: string | undefined;
  totalUsage?: unknown;
  error?: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Only allowlisted metadata leaves the adapter; never persist provider bodies or error text. */
export async function validatedModelOutput<T>(
  generate: () => Promise<ModelOutput>,
  schema: z.ZodType<T>,
  stage: ModelFailureDetails["stage"],
  signal: AbortSignal,
): Promise<{ object: T; usage: unknown }> {
  const details: ModelFailureDetails = { stage };
  const capture = (value: Record<string, unknown>) => {
    if (
      typeof value.statusCode === "number" &&
      Number.isInteger(value.statusCode) &&
      value.statusCode >= 400 &&
      value.statusCode <= 599
    ) {
      details.statusCode = value.statusCode;
    }
    if (
      ["stop", "length", "content-filter", "tool-calls", "error", "other", "unknown"].includes(
        String(value.finishReason),
      )
    ) {
      details.finishReason = String(value.finishReason);
    }
    const usage = record(value.totalUsage ?? value.usage);
    for (const key of ["inputTokens", "outputTokens", "reasoningTokens"] as const) {
      const count = usage[key];
      if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
        details[key] = count;
      }
    }
  };

  try {
    const result = await generate();
    capture(record(result));
    if (result.error) {
      throw result.error;
    }
    if (result.finishReason === "length") {
      throw new ModelFailure("MODEL_OUTPUT_TRUNCATED", details);
    }
    if (result.finishReason === "content-filter") {
      throw new ModelFailure("MODEL_CONTENT_FILTERED", details);
    }
    return { object: schema.parse(result.object), usage: result.totalUsage };
  } catch (error) {
    if (error instanceof PilotError) {
      throw error;
    }
    const names = new Set<unknown>();
    let cause: unknown = error;
    for (let depth = 0; cause && depth < 5; depth++) {
      const value = record(cause);
      capture(value);
      names.add(value.name);
      cause = value.cause;
    }
    let code = "MODEL_FAILURE";
    if (signal.aborted) {
      code = "MODEL_CANCELLED";
      if (signal.reason?.name === "TimeoutError") {
        code = "MODEL_TIMEOUT";
      }
    } else if (names.has("TimeoutError") || names.has("AbortError")) {
      code = "MODEL_TIMEOUT";
    } else if (details.statusCode) {
      code = `MODEL_HTTP_${details.statusCode}`;
    } else if (details.finishReason === "length") {
      code = "MODEL_OUTPUT_TRUNCATED";
    } else if (names.has("AI_JSONParseError") || names.has("SyntaxError")) {
      code = "MODEL_INVALID_JSON";
    } else if (names.has("ZodError") || names.has("AI_TypeValidationError")) {
      code = "MODEL_INVALID_OUTPUT";
    } else if (names.has("AI_NoObjectGeneratedError")) {
      code = "MODEL_NO_STRUCTURED_OUTPUT";
    }
    throw new ModelFailure(code, details);
  }
}
