import type { NextConfig } from "next";
import { readBuildEnv } from "@vitalos/config/build";
import { getSecurityHeaders } from "./src/config/security-headers";
import { nextRedirects } from "./src/features/redirects/next-redirects";

// Validated once at build/start. Invalid production configuration (for example fixtures or the
// memory enquiry backend in production) fails here, before anything is served.
const buildEnv = readBuildEnv();

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Inline the resolved site URL so client bundles and the server agree (VERCEL_URL fallback,
  // origin normalisation, localhost only for the local deploy env).
  env: { NEXT_PUBLIC_SITE_URL: buildEnv.siteUrl },
  headers: () => getSecurityHeaders(buildEnv),
  redirects: () => nextRedirects(),
};

export default config;
