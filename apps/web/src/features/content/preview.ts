import "server-only";
import { cache } from "react";
import { cookies, draftMode } from "next/headers";
import { getEnv } from "@vitalos/config";
import { PREVIEW_COOKIE } from "./http/handle-preview";
import type { PreviewData } from "./schemas";
import { getContentReaders } from "./server";
import { verifyPreviewToken } from "./signing";
import type { PreviewTokenPayload } from "./signing";

/**
 * Draft Mode (preview) for pages (brief 3.6, A5). `draftMode()` is read first: during static
 * rendering it is off and nothing else (no `cookies()`) is touched, so pages stay static. Only a
 * Draft Mode request reads the cookie, re-verifies the token and reads the working copy, uncached.
 */

export interface PreviewSession {
  token: string;
  payload: PreviewTokenPayload;
}

/** The verified preview session for this request, or null outside Draft Mode. */
export const getPreviewSession = cache(async (): Promise<PreviewSession | null> => {
  if (!(await draftMode()).isEnabled) return null;
  const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!token) return null;
  const verified = verifyPreviewToken(token, getEnv().content.previewKeys);
  return verified.ok ? { token, payload: verified.payload } : null;
});

/** Whether this request is a Draft Mode request (cheap; static renders answer false). */
export const isDraftModeRequest = async (): Promise<boolean> => (await draftMode()).isEnabled;

/**
 * The working copy for this request's preview session, read once per request. Null outside
 * Draft Mode, for an expired token, or when the admin cannot be reached.
 */
export const getPreviewData = cache(async (): Promise<PreviewData | null> => {
  const session = await getPreviewSession();
  if (!session) return null;
  try {
    const result = await getContentReaders().readPreview(
      session.payload.entity,
      session.payload.id,
      session.token,
    );
    return result.kind === "ok" ? result.data : null;
  } catch {
    return null;
  }
});
