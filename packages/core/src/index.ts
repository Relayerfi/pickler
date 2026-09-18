export type { Clock } from "./ports/clock";
export { createGetHealth } from "./application/get-health";
export { DataSourceUnavailableError } from "./shared/errors";

export * from "./features/landing/domain/landing";
export type { LandingReadModel } from "./features/landing/ports/landing-read-model";
export { createGetLanding, LANDING_LIMITS } from "./features/landing/application/get-landing";

export { InvalidEmailError, normalizeEmail } from "./features/waitlist/domain/email";
export type { WaitlistPlacement, WaitlistRepository } from "./features/waitlist/ports/waitlist-repository";
export { createJoinWaitlist, type JoinWaitlistOptions } from "./features/waitlist/application/join-waitlist";

export * from "./features/applications/domain/application";
export type { ApplicantRepository, SubmitOutcome } from "./features/applications/ports/applicant-repository";
export { createCheckTicker, createGetApplicant, createSubmitApplication } from "./features/applications/application/applications";

export * from "./features/agents/domain/agents";
export type { AgentDirectory } from "./features/agents/ports/agent-directory";
export {
  byRecord,
  createGetAgentPersona,
  createGetAgentProfile,
  createGetLeaderboard,
  createGetPickDetail,
  createGetPlatformAnalytics,
  createListAgents,
} from "./features/agents/application/agents";

export * from "./features/access/domain/modules";
export * from "./features/access/domain/api-scopes";
export * from "./features/access/domain/abilities";
export * from "./features/access/domain/principal";
export * from "./features/access/domain/authorization";
export { isIpAllowed } from "./features/access/domain/ip-allowlist";
export { InvalidAccessTokenError, type AccessTokenVerifier, type VerifiedAccessToken } from "./features/access/ports/access-token-verifier";
export { AccessDeniedError, AuthenticationRequiredError, InactiveWorkspaceError } from "./features/access/domain/errors";
export type { Workspace, WorkspaceDirectory } from "./features/access/ports/workspace-directory";
export type { ApiKeyDirectory, StoredApiKey } from "./features/access/ports/api-key-directory";
export {
  createAuthenticateRequest,
  type Authenticated,
  type AuthenticateDependencies,
  type AuthenticateOptions,
  type RequestCredentials,
} from "./features/access/application/authenticate-request";

export * from "./features/agent-registry/domain/agent";
export * from "./features/agent-registry/domain/events";
export type { AgentEventLog, AgentRegistry } from "./features/agent-registry/ports/agent-registry";
export { createAgentQueries, type AgentQueryDependencies } from "./features/agent-registry/application/agent-queries";
export {
  AGENT_AUTH_WINDOW_SECONDS,
  AgentAuthenticationError,
  canonicalBody,
  createAuthenticateAgent,
  type AgentAuthDependencies,
  type AgentAuthFailure,
  type AgentRequest,
} from "./features/agent-registry/application/authenticate-agent";

export * from "./features/budget/domain/amounts";
export * from "./features/budget/domain/ledger";
export type { BudgetSource } from "./features/budget/ports/budget-source";

export * from "./features/signing/domain/turnkey-activity";
export type { SignedActivityForwarder, TurnkeyReader } from "./features/signing/ports/signing";

export * from "./features/profiles/domain/profile";
export type { CreateProfileResult, ProfileRepository } from "./features/profiles/ports/profile-repository";
export { createProfileService, type HandleAvailability } from "./features/profiles/application/profiles";
