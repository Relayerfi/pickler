import type { Clock } from "@pickler/core";

export const systemClock: Clock = {
  now: () => new Date(),
};
export { SqliteResearchStore } from './persistence/research-store.js';
export { ExaResearch } from './research/exa.js';
export { PolymarketData } from './polymarket/market-data.js';
