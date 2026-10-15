import "server-only";
import { draftMode } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { getEnv } from "@vitalos/config";
import { createLogger } from "@vitalos/observability";
import { clearProxyLookupVerdicts } from "../lookup/proxy-lookup";
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

/**
 * Wires the framework-free content handlers to Next.js and the validated environment. Route
 * files under `app/api/content` call these and stay thin.
 */

const limiter = new MemoryRateLimiter();
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
  };
}

export function tickDeps(): TickDeps {
  return {
    cronSecret: getEnv().enquiry.cronSecret,
    limiter,
    readers: getContentReaders(),
    client: getContentClient(),
    expireSiteState: () => revalidateTag("site", { expire: 0 }),
    logger: getLogger(),
  };
}

/** Honest 503 for invalid configuration or an unexpected failure; nothing about why. */
export const unavailable = (): Response =>
  Response.json(
    { error: "unavailable" },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
