/**
 * Warns when an edit would change the public URL of an already-published document
 * (Stage 10 §9 "redirect warning on slug changes"; Stage 8 §7 "URL durability").
 * The publish action (src/actions) creates the draft redirect when the editor publishes.
 */
import { plannedUrlChange, type HrefSource } from "../document-href";
import { isRecord, issue, str, type Issue } from "./issue";
import { idPair } from "./redirect";
import type { FetchClient } from "./unique";

export async function slugChangeIssues(
  doc: unknown,
  id: string,
  client: FetchClient,
): Promise<Issue[]> {
  if (!isRecord(doc)) return [];
  const type = str(doc, "_type");
  if (type === undefined) return [];
  const [publishedId] = idPair(id);
  const published = await client.fetch<HrefSource | null>(
    `*[_id == $id][0]{slug, labType, topic, routeKey}`,
    { id: publishedId },
  );
  const change = plannedUrlChange(type, published, doc);
  if (!change) return [];
  return [
    issue(
      `This changes the public URL of a published page from ${change.from} to ${change.to}. Publishing creates a draft 301 redirect from the old URL; review and publish it, or visitors and search engines will hit a 404.`,
      "slug",
      "current",
    ),
  ];
}
