import { marketExclusion } from "./eligibility.js";
import { publicSourceUrl } from "./source-url.js";
import { evaluateDecision } from "./decision-policy.js";
import {
  PilotError,
  ModelFailure,
  DEFAULT_UNCERTAINTY_POLICY,
  assertMarket,
  type ResearchRepository,
  type ResearchModel,
  type WebSearch,
  type PageReader,
  type MarketData,
  type RunRecord,
  type Source,
  type OrderBook,
  type ToolName,
  type ResearchTools,
} from "./types.js";

/** The only research entry point: API, worker and Studio all dispatch through it. */
export function createResearchRunner(deps: {
  repository: Pick<ResearchRepository, "agent" | "event" | "finish" | "assertOwnership">;
  model: ResearchModel;
  search: WebSearch;
  reader: PageReader;
  markets: MarketData;
  now?: () => number;
}) {
  const { repository: repo } = deps;
  const now = deps.now ?? Date.now;
  return async function execute(run: RunRecord, parentSignal?: AbortSignal): Promise<void> {
    const signal = parentSignal
      ? AbortSignal.any([parentSignal, AbortSignal.timeout(run.config.limits.durationMs)])
      : AbortSignal.timeout(run.config.limits.durationMs);
    const sources = new Map<string, Source>();
    const quotes: OrderBook[] = [];
    const searchIntents = new Set<string>();
    let searches = 0;
    let reads = 0;
    let bookReads = 0;
    let providerFailure = false;
    const event = (type: string, data: unknown) => repo.event(run, type, data, now());
    const guard = async (tool?: ToolName) => {
      signal.throwIfAborted();
      await repo.assertOwnership(run);
      const current = await repo.agent(run);
      if (current.paused) {
        throw new PilotError("PAUSED", "Agent is paused");
      }
      if (current.version !== run.configVersion) {
        throw new PilotError("CONFIG_CHANGED", "Configuration changed during research");
      }
      if (tool && !current.config.tools.includes(tool)) {
        throw new PilotError("TOOL_DISABLED", "Tool is disabled");
      }
    };
    const external = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      try {
        const result = await fn();
        await event(name, result);
        return result;
      } catch (error) {
        providerFailure = true;
        await event("provider_failure", {
          operation: name,
          code: error instanceof PilotError ? error.code : "PROVIDER_FAILURE",
        });
        throw error;
      }
    };
    try {
      await event("runtime", {
        ...deps.model.metadata(),
        uncertaintyPolicy: {
          version: "1.0.0",
          config: run.config.uncertaintyPolicy ?? DEFAULT_UNCERTAINTY_POLICY,
        },
        plugins: { research: "1.0.0", "prediction-markets": "1.0.0" },
      });
      await guard("searchWeb");
      await guard("getMarketRules");
      await guard("getOrderBook");
      let marketId = run.marketId;
      if (!run.config.categoryIds.length) {
        throw new PilotError("CATEGORIES_REQUIRED", "Select categories before researching");
      }
      if (!marketId) {
        await guard("getMarketRules");
        const discovered = await external("candidates", () =>
          deps.markets.list(run.config.categoryIds, signal, (data) =>
            event("discovery_scan", data),
          ),
        );
        const selectionTime = now();
        const exclusions = discovered.map((m) => ({
          marketId: m.id,
          reason: m.categoryIds.some((c) => run.config.categoryIds.includes(c))
            ? marketExclusion(m, selectionTime, run.config.discoveryPolicy)
            : "CATEGORY_NOT_ALLOWED",
        }));
        await event(
          "discovery_exclusions",
          exclusions.filter((item) => item.reason),
        );
        const excluded = new Set(
          exclusions.filter((item) => item.reason).map((item) => item.marketId),
        );
        const candidates = discovered
          .filter((m) => !excluded.has(m.id))
          .sort((a, b) => b.liquidity - a.liquidity)
          .slice(0, 20);
        await event("eligible_candidates", candidates);
        if (!candidates.length) {
          throw new PilotError("NO_ELIGIBLE_MARKETS", "No eligible active markets found");
        }
        await guard();
        const selection = await deps.model.select(
          candidates,
          run.config.profile,
          signal,
          run.config.limits,
          new Date(now()).toISOString(),
          (data) => event("model_diagnostic", data),
        );
        await event("selection", selection);
        if (!candidates.some((m) => m.id === selection.marketId)) {
          throw new PilotError("INVALID_DECISION", "Selected market was not a candidate");
        }
        marketId = selection.marketId;
      }
      await guard("getMarketRules");
      const market = await external("market", () => deps.markets.get(marketId, signal));
      assertMarket(market, run.config.categoryIds, now());
      const exclusion = marketExclusion(market, now(), run.config.discoveryPolicy);
      if (exclusion) {
        throw new PilotError("NO_ELIGIBLE_MARKETS", exclusion);
      }
      await guard("getOrderBook");
      for (const outcome of market.outcomes) {
        await guard("getOrderBook");
        quotes.push(await external("initial_quote", () => deps.markets.book(outcome.id, signal)));
      }
      const tools: Partial<ResearchTools> = {};
      if (run.config.tools.includes("searchWeb")) {
        tools.searchWeb = async (query, intent) => {
          await guard("searchWeb");
          if (++searches > run.config.limits.searches) {
            throw new PilotError("TOOL_LIMIT", "Search limit reached");
          }
          if (!["supporting", "contradicting"].includes(intent)) {
            throw new PilotError("INVALID_INPUT", "Search intent is required");
          }
          await event("search_query", { query, intent });
          const result = await external("sources", async () => {
            const result = await deps.search.search(query, signal);
            return {
              ...result,
              sources: result.sources.map((source) => ({
                ...source,
                provenance: "search" as const,
              })),
            };
          });
          await event(
            "evidence_limitations",
            result.sources
              .map((source) => ({
                sourceId: source.id,
                missingPublicationDate: source.publishedAt === null,
                truncated: source.truncated,
                olderThanSevenDays:
                  source.publishedAt !== null &&
                  Date.parse(source.publishedAt) < now() - 7 * 86400000,
              }))
              .filter(
                (source) =>
                  source.missingPublicationDate || source.truncated || source.olderThanSevenDays,
              ),
          );
          searchIntents.add(intent);
          for (const source of result.sources) {
            sources.set(source.id, source);
          }
          return result.sources;
        };
      }
      if (run.config.tools.includes("readPage")) {
        tools.readPage = async (url) => {
          await guard("readPage");
          if (++reads > run.config.limits.pageReads) {
            throw new PilotError("TOOL_LIMIT", "Page read limit reached");
          }
          const normalized = publicSourceUrl(url);
          const resolution = (market.resolutionUrls ?? []).some(
            (link) => publicSourceUrl(link) === normalized,
          );
          if (
            !normalized ||
            (!resolution &&
              ![...sources.values()].some((s) => publicSourceUrl(s.url) === normalized))
          ) {
            throw new PilotError(
              "INVALID_INPUT",
              "Only discovered or resolution-rule URLs can be read",
            );
          }
          const source = await external("source", async () => ({
            ...(await deps.reader.read(normalized, signal)),
            requestedUrl: normalized,
            provenance: resolution ? ("resolution-rule-link" as const) : ("search" as const),
          }));
          sources.set(source.id, source);
          return source;
        };
      }
      if (run.config.tools.includes("getMarketRules")) {
        tools.getMarketRules = async () => {
          await guard("getMarketRules");
          return market;
        };
      }
      if (run.config.tools.includes("getOrderBook")) {
        tools.getOrderBook = async (outcomeId) => {
          await guard("getOrderBook");
          if (++bookReads > 6) {
            throw new PilotError("TOOL_LIMIT", "Quote call limit reached");
          }
          if (!market.outcomes.some((o) => o.id === outcomeId)) {
            throw new PilotError("INVALID_INPUT", "Outcome is not in selected market");
          }
          const quote = await external("quote", () => deps.markets.book(outcomeId, signal));
          quotes.push(quote);
          return quote;
        };
      }
      await guard();
      const result = await deps.model.research({
        beforeStep: async () => {
          await guard();
          if (providerFailure) {
            throw new PilotError("PROVIDER_FAILURE", "Research provider failed");
          }
        },
        selectionSteps: run.marketId ? 0 : 1,
        evidence: () => ({ sources: [...sources.values()], quotes }),
        onDiagnostic: (data) => event("model_diagnostic", data),
        market,
        profile: run.config.profile,
        tools,
        signal,
        limits: run.config.limits,
        onUsage: (usage) => event("model_step_usage", usage),
      });
      await event("model_usage", result.usage);
      await guard();
      if (providerFailure) {
        throw new PilotError("PROVIDER_FAILURE", "A provider failed; research is incomplete");
      }
      const decision = result.decision;
      await event("model_assessment", decision);
      let observedPrice: string | null = null;
      if (
        decision.marketId !== market.id ||
        decision.sourceIds.some((id) => !sources.has(id)) ||
        !decision.sourceIds.length
      ) {
        throw new PilotError(
          "INVALID_DECISION",
          "Decision must cite retrieved evidence for the selected market",
        );
      }
      if (!searchIntents.has("supporting") || !searchIntents.has("contradicting")) {
        throw new PilotError(
          "INCOMPLETE_RESEARCH",
          "Research must search both supporting and contradicting evidence",
        );
      }
      if (decision.action === "TRADE") {
        if (
          !market.outcomes.some((o) => o.id === decision.outcomeId) ||
          !decision.limitPrice ||
          !decision.expiresAt ||
          !Number.isFinite(Date.parse(decision.expiresAt)) ||
          Date.parse(decision.expiresAt) <= now()
        ) {
          throw new PilotError(
            "INVALID_DECISION",
            "Trade proposal requires valid outcome, limit and future expiry",
          );
        }
        await guard("getMarketRules");
        const freshMarket = await external("final_market", () =>
          deps.markets.get(market.id, signal),
        );
        assertMarket(freshMarket, run.config.categoryIds, now());
        const exclusion = marketExclusion(freshMarket, now(), run.config.discoveryPolicy);
        if (exclusion) {
          throw new PilotError("NO_ELIGIBLE_MARKETS", exclusion);
        }
        await guard("getOrderBook");
        const fresh = await external("final_quote", () =>
          deps.markets.book(decision.outcomeId!, signal),
        );
        const ask = fresh.asks[0];
        if (!ask) {
          throw new PilotError("NO_QUOTE", "No executable ask available");
        }
        observedPrice = ask.price;
      } else {
        if (!decision.abstentionReason) {
          throw new PilotError("INVALID_DECISION", "Abstention requires a reason");
        }
        observedPrice = null;
      }
      await guard();
      const finalDecision = evaluateDecision(
        decision,
        observedPrice,
        run.config.uncertaintyPolicy,
        now(),
      );
      await event("policy_evaluation", finalDecision.policyEvaluation);
      await repo.finish(run, finalDecision, null, now());
    } catch (error) {
      if (error instanceof PilotError && error.code === "LEASE_LOST") {
        throw error;
      }
      await repo.assertOwnership(run);
      if (error instanceof ModelFailure) {
        await event("model_failure", { code: error.code, ...error.details });
      }
      const code =
        error instanceof PilotError
          ? error.code
          : signal.aborted
            ? "DEADLINE_OR_CANCELLED"
            : "PROVIDER_OR_MODEL_FAILURE";
      await repo.finish(run, null, code, now());
    }
  };
}
