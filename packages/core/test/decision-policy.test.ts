import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateDecision } from "../src/features/research/decision-policy.js";
import {
  DEFAULT_UNCERTAINTY_POLICY,
  type ModelAssessment,
} from "../src/features/research/types.js";

const assessment: ModelAssessment = {
  action: "TRADE",
  marketId: "608546",
  outcomeId: "yes",
  thesis: "A possible edge",
  counterEvidence: "Uncertain voting",
  uncertainty: "High uncertainty",
  uncertaintyLevel: "HIGH",
  missingInformation: ["Unverified tournament performance"],
  probability: { lower: 0.0005, estimate: 0.003, upper: 0.01 },
  sourceIds: ["retrieved-source"],
  observedPrice: "0.9",
  limitPrice: "0.001",
  expiresAt: "2026-09-23T00:00:00Z",
  abstentionReason: null,
};

test("Vinicius-like assessment becomes abstention while preserving the original proposal", () => {
  const original = structuredClone(assessment);
  const result = evaluateDecision(assessment, "0.001", undefined, 100);
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.action, "ABSTAIN");
  assert.equal(result.observedPrice, "0.001");
  assert.equal(result.modelAssessment.action, "TRADE");
  assert.deepEqual(result.policyEvaluation.reasonCodes, [
    "HIGH_UNCERTAINTY",
    "MISSING_INFORMATION",
    "INSUFFICIENT_CONSERVATIVE_MARGIN",
  ]);
  assert.deepEqual(result.modelAssessment, original);
  assert.deepEqual(assessment, original);
  assert.notEqual(result.modelAssessment, assessment);
});

const strong: ModelAssessment = {
  ...assessment,
  uncertaintyLevel: "LOW",
  missingInformation: [],
  probability: { lower: 0.6, estimate: 0.65, upper: 0.7 },
  limitPrice: "0.5",
};

test("a proposal passing the conservative rules remains TRADE", () => {
  const result = evaluateDecision(strong, "0.4", undefined, 100);
  assert.equal(result.action, "TRADE");
  assert.deepEqual(result.policyEvaluation.reasonCodes, []);
  assert.equal(result.abstentionReason, null);
});

test("margin uses the worst proposed price and rejects equality at the boundary", () => {
  const input = { ...strong, probability: { lower: 0.51, estimate: 0.6, upper: 0.65 } };
  assert.ok(
    evaluateDecision(input, "0.4", undefined, 100).policyEvaluation.reasonCodes.includes(
      "INSUFFICIENT_CONSERVATIVE_MARGIN",
    ),
  );
  assert.equal(
    evaluateDecision(
      input,
      "0.4",
      { ...DEFAULT_UNCERTAINTY_POLICY, minProbabilityMargin: 0.005 },
      100,
    ).action,
    "TRADE",
  );
  assert.ok(
    evaluateDecision(strong, "0.51", undefined, 100).policyEvaluation.reasonCodes.includes(
      "PRICE_EXCEEDS_LIMIT",
    ),
  );
});

test("missing probability and wide ranges block otherwise acceptable proposals", () => {
  assert.ok(
    evaluateDecision(
      { ...strong, probability: null },
      "0.4",
      undefined,
      100,
    ).policyEvaluation.reasonCodes.includes("MISSING_PROBABILITY"),
  );
  assert.ok(
    evaluateDecision(
      { ...strong, probability: { lower: 0.6, estimate: 0.7, upper: 1 } },
      "0.4",
      undefined,
      100,
    ).policyEvaluation.reasonCodes.includes("WIDE_PROBABILITY_RANGE"),
  );
});

test("configuration controls individual uncertainty gates without changing the proposal", () => {
  const input = {
    ...strong,
    uncertaintyLevel: "HIGH" as const,
    missingInformation: ["Unknown detail"],
  };
  assert.equal(evaluateDecision(input, "0.4", undefined, 100).action, "ABSTAIN");
  const policy = {
    ...DEFAULT_UNCERTAINTY_POLICY,
    blockHighUncertainty: false,
    requireCompleteInformation: false,
  };
  const result = evaluateDecision(input, "0.4", policy, 100);
  assert.equal(result.action, "TRADE");
  assert.deepEqual(result.policyEvaluation.config, policy);
});

test("model abstention is never upgraded even by a permissive policy", () => {
  const input = {
    ...strong,
    action: "ABSTAIN" as const,
    probability: null,
    abstentionReason: "Not enough evidence",
  };
  const result = evaluateDecision(
    input,
    null,
    {
      blockHighUncertainty: false,
      requireCompleteInformation: false,
      minProbabilityMargin: 0,
      maxProbabilityRangeWidth: 1,
    },
    100,
  );
  assert.equal(result.action, "ABSTAIN");
  assert.equal(result.abstentionReason, input.abstentionReason);
  assert.deepEqual(result.policyEvaluation.reasonCodes, ["MODEL_ABSTAINED"]);
});

test("malformed probability ranges and invalid policies are errors, not abstentions", () => {
  for (const probability of [
    { lower: 0.7, estimate: 0.6, upper: 0.8 },
    { lower: 0.5, estimate: 0.9, upper: 0.8 },
    { lower: -1, estimate: 0.6, upper: 0.8 },
    { lower: 0.5, estimate: NaN, upper: 0.8 },
  ]) {
    assert.throws(() => evaluateDecision({ ...strong, probability }, "0.4", undefined, 100), {
      code: "INVALID_DECISION",
    });
  }
  assert.throws(() => evaluateDecision(strong, null, undefined, 100), { code: "NO_QUOTE" });
  assert.throws(
    () =>
      evaluateDecision(
        strong,
        "0.4",
        { ...DEFAULT_UNCERTAINTY_POLICY, minProbabilityMargin: -1 },
        100,
      ),
    { code: "INVALID_INPUT" },
  );
});
