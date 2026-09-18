import type { Clock } from "@pickler/core";

export const systemClock: Clock = {
  now: () => new Date(),
};

export { createSampleAgentDirectory } from "./agents/sample-agent-directory";
export { createSampleLandingReadModel, SAMPLE_AGENT_TICKERS } from "./landing/sample-landing-read-model";
export { createInMemoryApplicantStore, type InMemoryApplicantStoreOptions } from "./applicants/in-memory-applicant-store";
export { createSupabaseRestClient, type SupabaseConfig, type SupabaseRestClient } from "./supabase/supabase-rest-client";
export { createSupabaseWaitlist } from "./supabase/supabase-waitlist";
export { createSupabaseApplicants } from "./supabase/supabase-applicants";
export {
  decryptAes256Gcm,
  decryptLegacyAes256Gcm,
  decryptLegacySeparateColumns,
  DecryptionError,
  encryptAes256Gcm,
  isLegacyFormat,
} from "./crypto/aes-256-gcm";
export { createSupabaseJwtVerifier, type SupabaseJwtVerifierConfig } from "./auth/supabase-jwt-verifier";
export { createSupabaseAdmin, type SupabaseAdmin, type SupabaseAdminConfig } from "./supabase/supabase-admin-client";
export { createSupabaseWorkspaceDirectory } from "./supabase/access/supabase-workspace-directory";
export { createSupabaseApiKeyDirectory } from "./supabase/access/supabase-api-key-directory";
export { ANALYTICS_ROW_LIMIT, createSupabaseAgentEventLog, createSupabaseAgentRegistry } from "./supabase/agent-registry/supabase-agent-registry";
export { createSupabaseBudgetSource } from "./supabase/agent-registry/supabase-budget-source";
export { createTurnkeyReader, createTurnkeyStampingClient, sendStampedRequest, TURNKEY_API_BASE_URL, type TurnkeyApiKeyConfig, type TurnkeyTransportConfig } from "./turnkey/turnkey-transport";
export { createTurnkeyActivityForwarder, type ActivityForwarderConfig } from "./turnkey/turnkey-activity-forwarder";
export { createSupabaseProfileRepository } from "./supabase/profiles/supabase-profile-repository";
