import { PilotError, type Market, type ModelAssessment, type Source } from "./types.js";
export const NFL_SECTIONS = [
  "identity",
  "schedule",
  "rules",
  "teamContext",
  "injuries",
  "supporting",
  "contradicting",
  "quotes",
  "limitations",
] as const;
export interface ResearchReport {
  protocol: "nfl-winner-v1";
  forecast: {
    outcomeId: string | null;
    probability: { lower: number; estimate: number; upper: number } | null;
    inabilityReason: string | null;
  };
  sections: {
    section: (typeof NFL_SECTIONS)[number];
    status: "supported" | "conflicting" | "missing" | "not_applicable";
    explanation: string;
    sourceIds: string[];
  }[];
}
export interface SportsContext {
  status: "available" | "no_coverage" | "stale";
  sources: Source[];
  usage?: unknown;
}
export interface SportsData {
  context(
    market: Market,
    signal: AbortSignal,
    beforeRequest: (network?: boolean) => Promise<void>,
  ): Promise<SportsContext>;
}
export function validateReport(
  assessment: ModelAssessment,
  market: Market,
  sources: Source[],
): ResearchReport {
  const report = assessment.report;
  const fail = (reason: string) => {
    throw new PilotError(
      `INVALID_RESEARCH_REPORT_${reason}`,
      "Invalid NFL evidence or forecast attribution",
    );
  };
  if (!report || report.protocol !== "nfl-winner-v1") {
    return fail("PROTOCOL");
  }
  if (
    new Set(report.sections.map((s) => s.section)).size !== NFL_SECTIONS.length ||
    report.sections.length !== NFL_SECTIONS.length
  ) {
    return fail("SECTIONS");
  }
  const ids = new Set(sources.map((s) => s.id));
  for (const section of report.sections) {
    if (
      !NFL_SECTIONS.includes(section.section) ||
      !section.explanation.trim() ||
      section.sourceIds.some((id) => !ids.has(id)) ||
      (section.status === "supported" && !section.sourceIds.length)
    ) {
      return fail("ATTRIBUTION");
    }
  }
  const f = report.forecast;
  if (f.probability) {
    const { lower, estimate, upper } = f.probability;
    if (
      ![lower, estimate, upper].every(Number.isFinite) ||
      lower < 0 ||
      upper > 1 ||
      lower > estimate ||
      estimate > upper ||
      !market.outcomes.some((o) => o.id === f.outcomeId)
    ) {
      return fail("FORECAST");
    }
  } else if (!f.inabilityReason?.trim()) {
    return fail("MISSING_ESTIMATE_REASON");
  }
  if (
    assessment.action === "TRADE" &&
    (f.outcomeId !== assessment.outcomeId ||
      !f.probability ||
      !assessment.probability ||
      (["lower", "estimate", "upper"] as const).some(
        (key) => f.probability![key] !== assessment.probability![key],
      ))
  ) {
    return fail("TRADE_MISMATCH");
  }
  return report;
}
/** Only explicit NFL game moneylines; no guesses from category membership. */
export function nflMarketEligible(market: Market): boolean {
  return (
    market.sportsMarketType === "moneyline" &&
    /\b(NFL|National Football League)\b/i.test(market.question + " " + market.rules) &&
    !/\b(first half|first quarter|season winner|super bowl champion)\b/i.test(market.question)
  );
}
export function uniqueSources(sources: Source[]): Source[] {
  const urls = new Set<string>();
  const contents = new Set<string>();
  return sources.filter((source) => {
    const url = new URL(source.url);
    url.hash = "";
    const content = source.content.trim().replace(/\s+/g, " ");
    if (urls.has(url.href) || contents.has(content)) {
      return false;
    }
    urls.add(url.href);
    contents.add(content);
    return true;
  });
}
