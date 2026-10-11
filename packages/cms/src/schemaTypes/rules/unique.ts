/**
 * Async uniqueness rules that need to look at other documents. The Sanity client is injected so
 * the rules can be tested with an in-memory fake.
 */
import { studioApiVersion } from "../constants";
import { hasText, isRecord, issue, str, type Issue } from "./issue";
import { idPair, type RedirectLookup, type RedirectRecord } from "./redirect";

/** The subset of `SanityClient` the rules use. */
export interface FetchClient {
  fetch<R = unknown>(query: string, params?: Record<string, unknown>): Promise<R>;
}

/** Validation context subset: Studio passes `getClient`. */
export interface ClientContext {
  getClient(options: { apiVersion: string }): FetchClient;
}

export const clientFrom = (context: ClientContext): FetchClient =>
  context.getClient({ apiVersion: studioApiVersion });

/** Single-value uniqueness (route key, trust topic). `field` is a trusted constant, never user input. */
export async function uniqueFieldIssues(options: {
  client: FetchClient;
  type: string;
  id: string;
  field: string;
  value: unknown;
  message: string;
}): Promise<Issue[]> {
  const { client, type, id, field, value, message } = options;
  if (!hasText(value)) return [];
  const count = await client.fetch<number>(
    `count(*[_type == $type && !(_id in $ids) && ${field} == $value])`,
    { type, ids: idPair(id), value },
  );
  return count > 0 ? [issue(message, field)] : [];
}

/** Lab asset slugs are unique per lab type, because the URL is /labs/{type}/{slug}. */
export async function uniqueLabSlugIssues(
  doc: unknown,
  id: string,
  client: FetchClient,
): Promise<Issue[]> {
  if (!isRecord(doc)) return [];
  const labType = str(doc, "labType");
  const slug = isRecord(doc["slug"]) ? str(doc["slug"], "current") : undefined;
  if (!hasText(labType) || !hasText(slug)) return [];
  const count = await client.fetch<number>(
    `count(*[_type == "labAsset" && !(_id in $ids) && labType == $labType && slug.current == $slug])`,
    { ids: idPair(id), labType, slug },
  );
  return count > 0
    ? [issue("Another lab asset of this type already uses this slug.", "slug", "current")]
    : [];
}

/** Redirect lookup backed by a Sanity client. */
export function clientRedirectLookup(client: FetchClient): RedirectLookup {
  return {
    others: (excludeIds) =>
      client.fetch<RedirectRecord[]>(
        `*[_type == "redirect" && !(_id in $ids) && defined(source)]{_id, source, status, destination}`,
        { ids: excludeIds },
      ),
  };
}
