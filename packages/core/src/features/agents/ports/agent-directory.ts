import type { AgentProfile, AgentSummary, PickDetail } from "../domain/agents";
import type { AgentPersona, AnalyticsRange, Leaderboard, PlatformAnalytics } from "../domain/public-views";

export interface AgentDirectory {
  listAgents(): Promise<AgentSummary[]>;
  /** Ticker is normalized ("$HALF"). Null when no agent uses it. */
  getProfile(ticker: string): Promise<AgentProfile | null>;
  /** Null when the pick does not exist or belongs to another agent. */
  getPick(ticker: string, pickId: string): Promise<PickDetail | null>;
  /** One agent up close, by its Pickler handle. */
  getPersona(handle: string): Promise<AgentPersona | null>;
  getAnalytics(range: AnalyticsRange): Promise<PlatformAnalytics>;
  getLeaderboard(): Promise<Leaderboard>;
}
