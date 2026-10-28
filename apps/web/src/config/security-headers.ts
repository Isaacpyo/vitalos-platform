import type { NextConfig } from "next";
import type { BuildEnv } from "@vitalos/config/build";
import { buildCsp } from "@vitalos/security/csp";
import { ROBOTS_NOINDEX, buildSecurityHeaders } from "@vitalos/security/headers";

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
 * - The Relay realtime WebSocket origin only when Relay and its realtime key are configured.
 * - The Askbridge origin (script, connect, img) and Turnstile (script, frame) only when
 *   `ASKBRIDGE_SITE_KEY` is set, even if this site's own Turnstile keys are off (ADR-045).
 * - No other site may frame this one.
 * - `/pay` only: `form-action` also allows the Super Admin origin (`CONTENT_API_BASE_URL`), where the
 *   payment form posts, and Stripe Checkout, where it is redirected (AID-018).
 * - `upgrade-insecure-requests` everywhere except plain-http local runs.
 * - The content media host (`CONTENT_MEDIA_HOST`) in `img-src` and the CV upload host
 *   (`CAREERS_UPLOAD_HOST`) in `connect-src`, only when set (ADR-040, brief section 9).
 * - Production is indexable only on its canonical host (docs/seo/DECISIONS.md 9): a second rule
 *   sends `X-Robots-Tag: noindex, nofollow` for any other host, such as a `*.vercel.app` alias
 *   of the production deployment. It covers every path, static assets included.
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
    // Relay realtime pings (ADR-038): only when Relay is on and realtime is configured.
    connect: env.relayRealtimeOrigin ? [env.relayRealtimeOrigin] : [],
    // Askbridge widget (ADR-045): its origin and Turnstile, only when the site key is set.
    ...(env.askbridge ? { askbridgeOrigin: env.askbridge.origin } : {}),
  };

  const headers = buildSecurityHeaders({
    deployEnv: env.deployEnv,
    enableHsts: env.enableHsts,
    csp: buildCsp(policy),
  });

  const rules: HeaderRules = [{ source: "/:path*", headers }];
  // Later rules override the same header: the payment page's form leaves the site.
  const payOrigin = payCheckoutOrigin(env);
  if (payOrigin) {
    rules.push({
      source: "/pay",
      headers: [
        {
          key: "Content-Security-Policy",
          value: buildCsp({ ...policy, formActionOrigins: [payOrigin, STRIPE_CHECKOUT_ORIGIN] }),
        },
      ],
    });
  }
  if (env.indexable) {
    rules.push({
      source: "/:path*",
      missing: [{ type: "host", value: escapeRegExp(new URL(env.siteUrl).hostname) }],
      headers: [{ key: "X-Robots-Tag", value: ROBOTS_NOINDEX }],
    });
  }
  return rules;
}

/** Stripe Checkout, where the Super Admin redirects the `/pay` form (AID-018). */
export const STRIPE_CHECKOUT_ORIGIN = "https://checkout.stripe.com";

/** The Super Admin origin the `/pay` form posts to, or undefined when it is not configured. */
export function payCheckoutOrigin(env: Pick<BuildEnv, "contentApiOrigin">): string | undefined {
  if (!env.contentApiOrigin) return undefined;
  try {
    return new URL(env.contentApiOrigin).origin;
  } catch {
    return undefined;
  }
}

/** `has`/`missing` values are regular expressions; a host is matched literally. */
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
