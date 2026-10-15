import type { NextConfig } from "next";
import { readBuildEnv } from "@vitalos/config/build";
import { imagesConfig } from "./src/config/images";
import { getSecurityHeaders } from "./src/config/security-headers";
import { careersRewrites } from "./src/features/content/careers/rewrites";
import { insightsRewrites } from "./src/features/content/insights/rewrites";
import { nextRedirects } from "./src/features/redirects/next-redirects";

// Validated once at build/start. Invalid production configuration (for example fixtures or the
// memory enquiry backend in production) fails here, before anything is served.
const buildEnv = readBuildEnv();
// Remote images only from the Insights and Careers media host, when configured (ADR-040).
const images = imagesConfig(buildEnv.contentMediaOrigin);

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Inline the resolved site URL so client bundles and the server agree (VERCEL_URL fallback,
  // origin normalisation, localhost only for the local deploy env).
  env: { NEXT_PUBLIC_SITE_URL: buildEnv.siteUrl },
  // The enquiry form is the only Server Action. Its largest legitimate body is a 5000 character
  // goal (up to ~20 KB as UTF-8) plus short fields, so cap action bodies well below the 1 MB
  // default (workstream D, ADR-019).
  experimental: { serverActions: { bodySizeLimit: "64kb" } },
  ...(images ? { images } : {}),
  headers: () => getSecurityHeaders(buildEnv),
  redirects: () => nextRedirects(),
  // Insights format and Careers filters keep their query strings and stay static (ISR).
  rewrites: () =>
    Promise.resolve({
      beforeFiles: [...insightsRewrites, ...careersRewrites],
      afterFiles: [],
      fallback: [],
    }),
};

export default config;
