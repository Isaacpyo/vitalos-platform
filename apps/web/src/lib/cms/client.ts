import "server-only";
import { createClient } from "@sanity/client";
import { createSanityFetcher } from "./fetch";
import type { SanityClientLike, SanityFetcher } from "./fetch";

export interface SanityConnection {
  projectId: string;
  dataset: string;
  apiVersion: string;
  /** Viewer token with read access to drafts. Server only; never a NEXT_PUBLIC variable. */
  readToken?: string | undefined;
}

/**
 * Sanity clients for the web app. Published reads use the CDN and no token (the dataset is
 * public; revisit if it is ever made private). Draft reads use the read token, the `drafts`
 * perspective and the live API. Stega/visual-editing encoding is deliberately off: mappers work
 * on plain strings (ADR-018).
 */
export function createSanityFetcherFor(connection: SanityConnection): SanityFetcher {
  const base = {
    projectId: connection.projectId,
    dataset: connection.dataset,
    apiVersion: connection.apiVersion,
  };
  // The CDN is off for published reads too: after a webhook revalidation the CDN could still
  // serve the previous version for a short while and the ISR cache would store that stale copy.
  // Reads are cached by Next.js, so the live API is hit once per tag refresh, not per visitor.
  const published = createClient({ ...base, useCdn: false, perspective: "published" });
  const draft = connection.readToken
    ? createClient({
        ...base,
        useCdn: false,
        perspective: "drafts",
        token: connection.readToken,
      })
    : undefined;
  return createSanityFetcher({
    published: published as unknown as SanityClientLike,
    ...(draft ? { draft: draft as unknown as SanityClientLike } : {}),
  });
}

/** Client used only to validate Studio preview secrets (see `draft-mode.ts`). */
export function createPreviewClient(connection: SanityConnection & { readToken: string }) {
  return createClient({
    projectId: connection.projectId,
    dataset: connection.dataset,
    apiVersion: connection.apiVersion,
    useCdn: false,
    token: connection.readToken,
  });
}
