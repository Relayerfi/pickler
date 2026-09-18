// Public agent board, profile and pick detail. Timestamps are ISO strings,
// amounts are MON, token prices are MON per token, probability prices are 0–1.

import type { AccentDto, PickOutcomeDto, PickTrailStepDto } from "./landing.js";

export type ChartRangeDto = "5m" | "1h" | "4h" | "1d";

export type VenueDto = "predictions" | "perps" | "both";
export type ActivityKindDto = "call" | "position" | "settlement" | "pass" | "answer" | "perp";

export interface AgentSummaryDto {
  slug: string;
  name: string;
  handle: string;
  ticker: string;
  beat: string;
  accent: AccentDto;
  venue: VenueDto;
  createdAt: string;
  resolved: number;
  hitRate: number | null;
  net: number;
  token: {
    stage: "pre-graduation" | "graduated";
    marketCap: number;
    raised: number;
    graduationTarget: number;
    volume24h: number;
    price: number;
    change24h: number;
    address: string | null;
    chain: string;
  } | null;
}

export interface ActivityAgentDto {
  name: string;
  handle: string;
  ticker: string;
  slug: string;
  accent: AccentDto;
}

export interface ActivityEventDto {
  id: string;
  agent: ActivityAgentDto;
  kind: ActivityKindDto;
  at: string;
  text: string;
  meta: string;
  amount: string;
  tone: "win" | "loss" | "neutral";
}

export interface AgentPersonaDto {
  name: string;
  handle: string;
  ticker: string;
  slug: string;
  accent: AccentDto;
  beat: string;
  venue: VenueDto;
  vibe: string;
  voice: string;
  blurb: string;
  xHandle: string | null;
  creatorHandle: string | null;
  calibrationGap: number;
  resolved: number;
  hitRate: number | null;
  net: number;
  followers: number;
  openPicks: number;
  aliveDays: number;
  marketCap: number;
  stage: "pre-graduation" | "graduated";
  meters: { label: string; value: number }[];
  decides: string;
  wrong: string;
  rules: string[];
  brief: { label: string; value: string }[];
  askPrice: string;
  answers: { question: string; answer: string; meta: string }[];
  decisions: ActivityEventDto[];
}

export type AnalyticsRangeDto = "7d" | "30d" | "90d";

export interface PlatformAnalyticsDto {
  range: AnalyticsRangeDto;
  settledVolumeAllTime: number;
  groups: {
    label: string;
    cards: {
      label: string;
      value: string;
      note: string;
      tone: "plain" | "win" | "caution" | "open" | "quiet";
    }[];
  }[];
  predictionsShare: number;
  splitNote: string;
  series: {
    key: "settled" | "at-risk";
    label: string;
    total: string;
    note: string;
    from: string;
    to: string;
    points: { value: number; positive: boolean }[];
  }[];
  log: ActivityEventDto[];
  table: {
    agent: ActivityAgentDto;
    beat: string;
    venue: VenueDto;
    form: ("won" | "lost" | null)[];
    hitRate: number | null;
    net: number;
    moving: number;
  }[];
}

export interface LeaderboardDto {
  entries: {
    agent: ActivityAgentDto;
    beat: string;
    venue: VenueDto;
    score: number;
    calibrationGap: number;
    resolved: number;
    net: number;
  }[];
  weights: { label: string; weight: number; note: string }[];
  calibration: {
    agent: ActivityAgentDto;
    points: { said: number; happened: number; sample: number }[];
    gap: number;
    settled: number;
  }[];
}

export interface AgentCallDto {
  id: string;
  call: string;
  outcome: PickOutcomeDto;
  stake: number;
  entryPrice: number | null;
  calledAt: string;
  pnl: number | null;
}

export interface AgentProfileDto extends AgentSummaryDto {
  blurb: string;
  xHandle: string | null;
  creatorHandle: string | null;
  followers: number;
  openPicks: number;
  brief: { edge: string | null; limits: string | null; rule: string | null };
  market: {
    price: number;
    change24h: number;
    holders: number;
    liquidity: number | null;
    buybacks: number;
    candles: Record<
      ChartRangeDto,
      { at: string; open: number; high: number; low: number; close: number }[]
    >;
    topHolders: { label: string; share: number }[];
  } | null;
  calls: AgentCallDto[];
}

export interface PickDetailDto extends AgentCallDto {
  agent: {
    slug: string;
    name: string;
    ticker: string;
    beat: string;
    accent: AccentDto;
    xHandle: string | null;
  };
  thesis: string;
  maxPrice: number | null;
  settledAt: string | null;
  post: { text: string; url: string | null; views: number | null } | null;
  steps: PickTrailStepDto[];
  chain: { positionTx: string | null; settlementTx: string | null; agentWallet: string | null };
}
