import { resolve } from "node:path";
import { config } from "dotenv";
import { z } from "zod";
config({ path: resolve(process.cwd(), ".env"), quiet: true });
const schema = z.object({
  MODEL_BASE_URL: z.string().url(),
  MODEL_ID: z.string().min(1),
  MODEL_API_KEY: z.string().min(1),
  EXA_API_KEY: z.string().min(1),
  TENANT_ALPHA_TOKEN: z.string().min(32),
  TENANT_BETA_TOKEN: z.string().min(32),
});
export function readEnv(env: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Configure required environment variables: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  const value = result.data;
  const url = new URL(value.MODEL_BASE_URL);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  ) {
    throw new Error("MODEL_BASE_URL must use HTTPS or local loopback HTTP");
  }
  if (value.TENANT_ALPHA_TOKEN === value.TENANT_BETA_TOKEN) {
    throw new Error("Tenant tokens must be distinct");
  }
  return { ...value, dataDir: resolve(process.cwd(), ".data") };
}

export type Environment = ReturnType<typeof readEnv>;
