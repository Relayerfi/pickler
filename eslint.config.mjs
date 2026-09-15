import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: "apps/web/" } } },
  globalIgnores(["**/.next/**", "**/dist/**", "**/.mastra/**", "**/.turbo/**", "**/next-env.d.ts", "contracts/out/**", "contracts/cache/**"]),
  {
    files: ["packages/core/**/*.{ts,tsx}", "packages/api-schema/**/*.{ts,tsx}", "packages/chain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["next", "next/*", "react", "@pickler/infrastructure", "@pickler/ui", "@pickler/web", "@pickler/core", "@pickler/api-schema", "@pickler/chain", "@mastra/*", "@ai-sdk/*"] }],
    },
  },
  {
    files: ["packages/infrastructure/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["next", "next/*", "react", "@pickler/ui", "@pickler/web"] }],
    },
  },
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@pickler/core", "@pickler/infrastructure", "@pickler/web", "next", "next/*"] }],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/server/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@pickler/core", "@pickler/infrastructure"] }],
    },
  },
]);
