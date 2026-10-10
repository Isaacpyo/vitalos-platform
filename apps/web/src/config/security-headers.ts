import type { NextConfig } from "next";
import type { BuildEnv } from "@vitalos/config/build";
import { buildCsp } from "@vitalos/security/csp";
import { buildSecurityHeaders } from "@vitalos/security/headers";

type HeaderRules = Awaited<ReturnType<NonNullable<NextConfig["headers"]>>>;

export interface SecurityHeaderOptions {
  /** `next dev`: adds `'unsafe-eval'` for React debugging. */
  isDev?: boolean;
}

/**
 * Security headers for `next.config.ts` (ADR-020). Applies to every path, including static
 * assets, API routes and not-found responses, so `X-Robots-Tag: noindex, nofollow` covers the
 * whole site whenever the deploy env is not `production`.
 *
 * Per-environment decisions live here; `@vitalos/security` only builds strings:
 * - Turnstile origins only when both Turnstile keys are configured.
 * - Sanity API connections (draft/preview, visual editing) only outside production.
 * - Sanity Studio may frame the site (Presentation) only outside production.
 * - `upgrade-insecure-requests` everywhere except plain-http local runs.
 */
export function getSecurityHeaders(
  env: BuildEnv,
  options: SecurityHeaderOptions = {},
): HeaderRules {
  const isDev = options.isDev ?? process.env.NODE_ENV === "development";
  const nonProduction = env.deployEnv !== "production";

  const policy = {
    isDev,
    turnstile: env.turnstileEnabled,
    ...(env.sanityProjectId ? { sanityProjectId: env.sanityProjectId } : {}),
    sanityApiConnect: nonProduction,
    frameAncestors: nonProduction && env.sanityStudioOrigin ? [env.sanityStudioOrigin] : [],
    upgradeInsecureRequests: env.deployEnv !== "local",
  };

  const headers = buildSecurityHeaders({
    deployEnv: env.deployEnv,
    enableHsts: env.enableHsts,
    csp: buildCsp(policy),
  });

  return [{ source: "/:path*", headers }];
}
