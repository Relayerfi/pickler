import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@pickler/ui",
    "@pickler/core",
    "@pickler/infrastructure",
    "@pickler/api-schema",
  ],
};
export default config;
