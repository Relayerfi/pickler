import type { AgentCredentialRecord, RegisteredAgent } from "../domain/agent";
import type { AgentEvent, AuditPage, AuditQuery } from "../domain/events";

export interface AgentRegistry {
  findById(id: string): Promise<RegisteredAgent | null>;
  listByWorkspace(workspaceId: string): Promise<RegisteredAgent[]>;
  /** Includes the encrypted secret; only the HMAC authenticator may call it. */
  findCredentials(id: string): Promise<AgentCredentialRecord | null>;
}

export interface AgentEventLog {
  listSince(agentId: string, since: Date): Promise<AgentEvent[]>;
  audit(agentId: string, query: AuditQuery): Promise<AuditPage>;
}
