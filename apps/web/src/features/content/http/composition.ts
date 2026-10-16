import "server-only";
import { draftMode } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { getEnv } from "@vitalos/config";
import { createLogger } from "@vitalos/observability";
import { clearProxyLookupVerdicts } from "../lookup/proxy-lookup";
import { createSlugGuard } from "../lookup/slug-guard";
import { renderMarkdown } from "../markdown/render";
import { getContentClient, getContentReaders } from "../server";
import { siteHosts } from "../site-hosts";
import { MemoryRateLimiter } from "./guards";
import type { EnterPreviewDeps, ExitPreviewDeps } from "./handle-preview";
import type { LookupDeps } from "./handle-lookup";
import type { RenderDeps } from "./handle-render";
import type { RevalidateDeps } from "./handle-revalidate";
import { warmPaths } from "./handle-revalidate";
import type { TickDeps } from "./handle-tick";
import { TURNSTILE_PROVIDER_ERRORS, verifyTurnstileToken } from "@vitalos/security/turnstile";
import type { CareersDeps, HumanCheck } from "../careers/http";

/**
 * Wires the framework-free content handlers to Next.js and the validated environment. Route
 * files under `app/api/content` call these and stay thin.
 */

const limiter = new MemoryRateLimiter();
/** Per instance: at most 30 admin reads a minute for slugs the sitemap does not list. */
const slugGuard = createSlugGuard({ perMinute: 30 });
let logger: ReturnType<typeof createLogger> | undefined;
const getLogger = () =>
  (logger ??= createLogger({ service: "vitalos-web", env: getEnv().deployEnv }));

/** Plain-http local runs cannot set `Secure` cookies. */
const secureCookies = () => !getEnv().siteUrl.startsWith("http://");

export function revalidateDeps(): RevalidateDeps {
  const env = getEnv();
  return {
    keys: env.content.revalidateKeys,
    limiter,
    revalidateTag: (tag, profile) => revalidateTag(tag, profile),
    revalidatePath: (path) => revalidatePath(path),
    warm: (paths) => {
      try {
        after(() => warmPaths(env.siteUrl, paths).catch(() => undefined));
      } catch {
        // Outside a request scope: skip warming; the next visitor renders the page.
      }
    },
    clearLookupVerdicts: clearProxyLookupVerdicts,
    logger: getLogger(),
  };
}

export function renderDeps(): RenderDeps {
  const env = getEnv();
  return {
    keys: env.content.renderKeys,
    limiter,
    render: renderMarkdown,
    mediaOrigin: env.content.mediaOrigin,
    siteHosts: siteHosts(),
    logger: getLogger(),
  };
}

export function enterPreviewDeps(): EnterPreviewDeps {
  return {
    keys: getEnv().content.previewKeys,
    limiter,
    readers: getContentReaders(),
    enableDraftMode: async () => (await draftMode()).enable(),
    secureCookies: secureCookies(),
    logger: getLogger(),
  };
}

export function exitPreviewDeps(): ExitPreviewDeps {
  return {
    limiter,
    disableDraftMode: async () => (await draftMode()).disable(),
    secureCookies: secureCookies(),
  };
}

export function lookupDeps(): LookupDeps {
  return {
    readSecret: getEnv().content.readKey?.secret,
    limiter,
    readers: getContentReaders(),
    guard: slugGuard,
  };
}

export function tickDeps(): TickDeps {
  return {
    secrets: [getEnv().enquiry.cronSecret, getEnv().content.tickSecret],
    limiter,
    readers: getContentReaders(),
    client: getContentClient(),
    expireSiteState: () => revalidateTag("site", { expire: 0 }),
    logger: getLogger(),
  };
}

export function careersDeps(): CareersDeps {
  const env = getEnv();
  const secret = env.turnstile.secretKey;
  const production = env.deployEnv === "production";
  const verifyHuman = async (token: string, ip: string | undefined): Promise<HumanCheck> => {
    // Without Turnstile keys the check is off outside production and fails closed in it.
    if (!secret) return production ? "unavailable" : "disabled";
    const result = await verifyTurnstileToken({
      secret,
      token,
      expectedAction: "careers",
      ...(ip ? { remoteIp: ip } : {}),
      ...(production ? { expectedHostname: new URL(env.siteUrl).hostname } : {}),
    });
    if (result.success) return "passed";
    return result.errorCodes.some((code) => TURNSTILE_PROVIDER_ERRORS.includes(code))
      ? "unavailable"
      : "failed";
  };
  return {
    client: env.content.submitKey ? getContentClient() : null,
    limiter,
    siteOrigin: env.siteUrl,
    verifyHuman,
    readers: getContentReaders(),
    renderProcess: (markdown) =>
      renderMarkdown(markdown, { context: "settings", siteHosts: siteHosts() }),
    logger: getLogger(),
  };
}

/** Honest 503 for invalid configuration or an unexpected failure; nothing about why. */
export const unavailable = (): Response =>
  Response.json(
    { error: "unavailable" },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
