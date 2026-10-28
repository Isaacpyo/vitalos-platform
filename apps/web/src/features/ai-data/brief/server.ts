import "server-only";
import { getEnv } from "@vitalos/config";
import { createBriefAssistClient } from "./assist-client";
import type { BriefAssistClient } from "./assist-client";

/** Composition for the brief-assist client: the validated environment, built once. */

let client: BriefAssistClient | null | undefined;

/** The signed client, or null when no base URL or read key is configured (AI unavailable). */
export function getBriefAssistClient(): BriefAssistClient | null {
  if (client !== undefined) return client;
  const { briefAssistBaseUrl, readKey } = getEnv().content;
  client =
    briefAssistBaseUrl && readKey
      ? createBriefAssistClient({ baseUrl: briefAssistBaseUrl, key: readKey })
      : null;
  return client;
}

/** Whether the page may offer the AI opt-in at all on this deployment. */
export function isBriefAssistConfigured(): boolean {
  return getBriefAssistClient() !== null && Boolean(getEnv().enquiry.ipHashSalt);
}
