import { isSafeRelativeRedirect } from "@vitalos/security/url";
import { defineEnableDraftMode } from "next-sanity/draft-mode";
import type { DefineEnableDraftModeOptions } from "next-sanity/draft-mode";

/**
 * Draft Mode endpoints (ADR-018).
 *
 * Enable: Sanity Studio's Presentation tool opens `/api/draft-mode/enable?sanity-preview-secret=...`.
 * The secret is validated by next-sanity against a short-lived secret document in the dataset
 * (read with the read token), so only someone who is signed in to the Studio can obtain one.
 * A missing or wrong secret answers 401 and never sets a cookie. When Sanity or the read token
 * is not configured the endpoint answers 503 instead of enabling anything.
 */

export interface DraftModeConfig {
  projectId: string | undefined;
  dataset: string;
  apiVersion: string;
  readToken: string | undefined;
}

type PreviewClient = DefineEnableDraftModeOptions["client"];

export interface EnableDraftModeDeps {
  getConfig(): DraftModeConfig;
  /** Builds the client used to validate the preview secret. */
  createClient(config: DraftModeConfig & { projectId: string; readToken: string }): PreviewClient;
  /** Injectable for tests; defaults to next-sanity's handler. */
  define?: (options: DefineEnableDraftModeOptions) => { GET(request: Request): Promise<Response> };
}

const text = (message: string, status: number) =>
  new Response(message, { status, headers: { "cache-control": "no-store" } });

export function createEnableDraftModeHandler(deps: EnableDraftModeDeps) {
  const define = deps.define ?? defineEnableDraftMode;
  return async function GET(request: Request): Promise<Response> {
    const config = deps.getConfig();
    if (!config.projectId || !config.readToken) {
      return text("Draft mode is not configured.", 503);
    }
    const client = deps.createClient({
      ...config,
      projectId: config.projectId,
      readToken: config.readToken,
    });
    const response = await define({ client }).GET(request);
    // `GET` redirects on success (thrown by next/navigation); a returned response is a refusal.
    response.headers.set("cache-control", "no-store");
    return response;
  };
}

export interface DisableDraftModeDeps {
  /** `(await draftMode()).disable()`; injectable for tests. */
  disable(): Promise<void>;
}

/**
 * Leaves Draft Mode, then redirects to a same-site path (`?redirect=`, default "/"). POST (the
 * banner's form) answers 303 so the browser follows with a GET; GET (Presentation) answers 307.
 * The Location is a relative path, so it cannot leave the site or depend on the request host.
 */
export function createDisableDraftModeHandler(deps: DisableDraftModeDeps) {
  const respond = (status: 303 | 307) =>
    async function handle(request: Request): Promise<Response> {
      await deps.disable();
      const location = safeReturnPath(new URL(request.url).searchParams.get("redirect"));
      return new Response(null, {
        status,
        headers: { location, "cache-control": "no-store" },
      });
    };
  return { POST: respond(303), GET: respond(307) };
}

/** Where to send the editor after leaving Draft Mode: a same-site path, never an external URL. */
export function safeReturnPath(value: string | null): string {
  return value && isSafeRelativeRedirect(value) ? value : "/";
}
