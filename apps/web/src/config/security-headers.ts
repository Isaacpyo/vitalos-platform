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
 * - No other site may frame this one.
 * - `upgrade-insecure-requests` everywhere except plain-http local runs.
 * - The content media host (`CONTENT_MEDIA_HOST`) in `img-src` and the CV upload host
 *   (`CAREERS_UPLOAD_HOST`) in `connect-src`, only when set (ADR-036, brief section 9).
 */
export function getSecurityHeaders(
  env: BuildEnv,
  options: SecurityHeaderOptions = {},
): HeaderRules {
  const isDev = options.isDev ?? process.env.NODE_ENV === "development";

  const policy = {
    isDev,
    turnstile: env.turnstileEnabled,
    upgradeInsecureRequests: env.deployEnv !== "local",
    imgOrigins: env.contentMediaOrigin ? [env.contentMediaOrigin] : [],
    // The browser uploads CVs straight to the ticket's host: the upload host, or the admin itself
    // (the A9 fallback) when no upload host is configured.
    connectOrigins: [env.careersUploadOrigin ?? env.contentApiOrigin].filter(
      (origin): origin is string => Boolean(origin),
    ),
  };

  const headers = buildSecurityHeaders({
    deployEnv: env.deployEnv,
    enableHsts: env.enableHsts,
    csp: buildCsp(policy),
  });

  return [{ source: "/:path*", headers }];
}
