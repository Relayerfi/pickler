import { z } from "zod";
import {
  PilotError,
  type Market,
  type MarketData,
  type Category,
  type OrderBook,
} from "@pickler/core";
import { providerJson } from "../research/http.js";
const tag = z.object({ id: z.string().regex(/^\d+$/), label: z.string().min(1) });
const wireMarket = z.object({
  id: z.string().regex(/^\d+$/),
  question: z.string().min(1),
  description: z.string().min(1),
  active: z.boolean(),
  closed: z.boolean(),
  enableOrderBook: z.boolean().optional(),
  acceptingOrders: z.boolean().optional(),
  endDate: z.string().nullish(),
  liquidityNum: z.number().nonnegative().nullish(),
  outcomes: z.string(),
  clobTokenIds: z.string(),
  tags: z.array(tag).optional(),
});
const price = z.string().regex(/^(0(\.\d{1,8})?|1(\.0{1,8})?)$/);
const level = z.object({ price, size: z.string().regex(/^\d+(\.\d+)?$/) });
const bookSchema = z.object({
  asset_id: z.string(),
  timestamp: z.string().regex(/^\d+$/),
  bids: z.array(level),
  asks: z.array(level),
});
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new PilotError("INVALID_PROVIDER_RESPONSE", "Invalid Polymarket response");
  }
  return result.data;
}

function mapMarket(m: z.infer<typeof wireMarket>, categories: string[]): Market {
  let labels: string[], ids: string[];
  try {
    labels = parse(z.array(z.string().min(1)).min(2).max(10), JSON.parse(m.outcomes));
    ids = parse(z.array(z.string().regex(/^\d+$/)).min(2).max(10), JSON.parse(m.clobTokenIds));
  } catch {
    throw new PilotError("INVALID_PROVIDER_RESPONSE", "Invalid outcome metadata");
  }
  if (ids.length !== labels.length || new Set(ids).size !== ids.length) {
    throw new PilotError("INVALID_PROVIDER_RESPONSE", "Outcome metadata mismatch");
  }
  if (m.endDate && !Number.isFinite(Date.parse(m.endDate))) {
    throw new PilotError("INVALID_PROVIDER_RESPONSE", "Invalid closing date");
  }
  // Preserve complete resolution rules; fail rather than silently truncate them.
  if (m.description.length > 16000) {
    throw new PilotError("RULES_TOO_LARGE", "Resolution rules exceed pilot context limit");
  }
  return {
    id: m.id,
    question: m.question.slice(0, 1000),
    rules: m.description,
    categoryIds: categories,
    active: m.active && !m.closed && m.enableOrderBook !== false && m.acceptingOrders !== false,
    closesAt: m.endDate ?? null,
    liquidity: m.liquidityNum ?? 0,
    outcomes: ids.map((id, i) => ({ id, label: labels[i]! })),
  };
}

export class PolymarketData implements MarketData {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  private getJson(path: string, signal: AbortSignal) {
    return providerJson(`https://gamma-api.polymarket.com${path}`, {}, signal, this.fetcher);
  }

  async categories(signal: AbortSignal): Promise<Category[]> {
    // Explicit bounded catalog page; clients can also configure known tag IDs.
    return parse(z.array(tag), await this.getJson("/tags?limit=100&offset=0", signal)).map((t) => ({
      id: t.id,
      label: t.label,
    }));
  }

  async list(categoryIds: string[], signal: AbortSignal): Promise<Market[]> {
    if (
      !categoryIds.length ||
      categoryIds.length > 10 ||
      categoryIds.some((id) => !/^\d+$/.test(id))
    ) {
      throw new PilotError("CATEGORIES_REQUIRED", "Select categories");
    }
    const candidates = new Map<string, Market>();
    for (const id of categoryIds) {
      const rows = parse(
        z.array(wireMarket).max(20),
        await this.getJson(
          `/markets?tag_id=${id}&closed=false&active=true&limit=20&order=liquidityNum&ascending=false&include_tag=true`,
          signal,
        ),
      );
      for (const row of rows) {
        // The filter is provider provenance; independently revalidate tags on the selected market.
        const old = candidates.get(row.id);
        candidates.set(
          row.id,
          mapMarket(row, [
            ...new Set([...(old?.categoryIds ?? []), ...(row.tags?.map((t) => t.id) ?? []), id]),
          ]),
        );
      }
    }
    return [...candidates.values()]
      .filter((m) => m.active)
      .sort((a, b) => b.liquidity - a.liquidity)
      .slice(0, 20);
  }

  async get(id: string, signal: AbortSignal): Promise<Market> {
    if (!/^\d+$/.test(id)) {
      throw new PilotError("INVALID_INPUT", "Invalid market ID");
    }
    const row = parse(wireMarket, await this.getJson(`/markets/${id}`, signal));
    if (row.id !== id) {
      throw new PilotError("INVALID_PROVIDER_RESPONSE", "Market ID mismatch");
    }
    const tags = parse(z.array(tag), await this.getJson(`/markets/${id}/tags`, signal));
    return mapMarket(
      row,
      tags.map((t) => t.id),
    );
  }

  async book(outcomeId: string, signal: AbortSignal): Promise<OrderBook> {
    if (!/^\d+$/.test(outcomeId)) {
      throw new PilotError("INVALID_INPUT", "Invalid outcome ID");
    }
    const result = parse(
      bookSchema,
      await providerJson(
        `https://clob.polymarket.com/book?token_id=${outcomeId}`,
        {},
        signal,
        this.fetcher,
      ),
    );
    if (result.asset_id !== outcomeId || !Number.isFinite(Number(result.timestamp))) {
      throw new PilotError("INVALID_PROVIDER_RESPONSE", "Order book mismatch");
    }
    const timestamp = Number(result.timestamp);
    if (Math.abs(Date.now() - timestamp) > 120_000) {
      throw new PilotError("STALE_QUOTE", "Order book timestamp is stale");
    }
    return {
      outcomeId,
      observedAt: new Date(timestamp).toISOString(),
      bids: result.bids
        .filter((l) => Number(l.size) > 0)
        .sort((a, b) => Number(b.price) - Number(a.price))
        .slice(0, 20),
      asks: result.asks
        .filter((l) => Number(l.size) > 0)
        .sort((a, b) => Number(a.price) - Number(b.price))
        .slice(0, 20),
    };
  }
}
