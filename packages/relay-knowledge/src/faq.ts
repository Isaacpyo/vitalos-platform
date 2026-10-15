import { mapFaqRow } from "@vitalos/relay-core/knowledge";
import type { FaqMapped, FaqRow, KnowledgeEntry } from "@vitalos/relay-core/knowledge";
import snapshotJson from "../faq/master-faq.snapshot.json" with { type: "json" };

export const FAQ_DATA_SOURCE_ID = "3fae4b34-11f9-80b0-9910-000b57eabfa1";
export const FAQ_DATABASE_ID = "3fae4b34-11f9-808c-b450-c69d43e8f22c";
export const FAQ_HUB_PAGE_ID = "3fae4b34-11f9-8053-9467-e390b032064a";
export const FAQ_DATABASE_URL = "https://app.notion.com/p/3fae4b3411f9808cb450c69d43e8f22c";
export const SNAPSHOT_VERSION = 1;

/** Committed snapshot: Verified, sanitised entries only (Source and Confirm note removed). */
export interface FaqSnapshot {
  version: number;
  generatedAt: string;
  from: "notion" | "export-verified-against-notion";
  dataSourceId: string;
  hubStatus: "Draft" | "Active";
  counts: {
    total: number;
    verified: number;
    needsConfirmation: number;
    held: number;
    live: number;
  };
  entries: FaqRow[];
  /** Id, section and link only: never the text of an unconfirmed entry. */
  needsConfirmation: { id: string; section: string; notionPageId: string; notionUrl: string }[];
  held: {
    id: string;
    section: string;
    notionPageId: string;
    notionUrl: string;
    reasons: string[];
  }[];
  /** Entries left out because the export and Notion disagreed when the snapshot was built. */
  drifted?: { id: string; reason: string }[];
}

export const faqSnapshot = snapshotJson as FaqSnapshot;

export interface FaqEntriesOptions {
  routeExists: (path: string) => boolean;
  requireHubActive: boolean;
  /** Overrides the snapshot's hub status (live sync reads it from Notion). */
  hubActive?: boolean;
}

/** Knowledge entries from the committed snapshot (deploys without Notion access). */
export function faqEntriesFromSnapshot(options: FaqEntriesOptions): {
  entries: KnowledgeEntry[];
  mapped: FaqMapped[];
} {
  const hubActive = options.hubActive ?? faqSnapshot.hubStatus === "Active";
  const mapped = faqSnapshot.entries.map((row) =>
    mapFaqRow(row, {
      routeExists: options.routeExists,
      requireHubActive: options.requireHubActive,
      hubActive,
    }),
  );
  return { entries: mapped.map((m) => m.entry), mapped };
}
