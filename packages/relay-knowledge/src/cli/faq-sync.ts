/**
 * pnpm relay:faq-sync [--full] [--dry-run] [--snapshot]
 *
 * Syncs the Vitalos Master FAQ into the `relay` schema (Relay follow-up, section 7). With
 * NOTION_FAQ_TOKEN it reads Notion: incremental by default (rows edited since the last good run,
 * minus two minutes), --full for a reconciliation that archives entries no longer Verified. Without
 * a token, or with --snapshot, it ingests the committed snapshot instead. Only Verified rows are
 * indexed; held rows (CONFIRM/TODO/TBC markers, placeholders, prices, internal references, banned
 * words) are stored as drafts for review and never published.
 *
 * Environment: SUPABASE_URL, SUPABASE_SECRET_KEY (unless --dry-run); NOTION_FAQ_TOKEN,
 * NOTION_FAQ_DATA_SOURCE_ID, NOTION_FAQ_HUB_PAGE_ID, NOTION_API_VERSION (optional);
 * RELAY_EMBED_FUNCTION_URL + RELAY_EMBED_SECRET (optional); RELAY_FAQ_REQUIRE_HUB_ACTIVE (default
 * true when VITALOS_DEPLOY_ENV/VERCEL_ENV is production). Prints counts and ids only, never
 * entry text.
 */
import { NotionFaqReader } from "@vitalos/relay-core";
import {
  HttpEmbedder,
  SupabaseRelayStore,
  ingestEntries,
  mapFaqRow,
  nullEmbedder,
} from "@vitalos/relay-core/knowledge";
import type { FaqMapped } from "@vitalos/relay-core/knowledge";
import { listPublicPaths } from "../cms";
import { FAQ_DATA_SOURCE_ID, FAQ_HUB_PAGE_ID, faqEntriesFromSnapshot, faqSnapshot } from "../faq";

const args = new Set(process.argv.slice(2));
const production =
  process.env.VITALOS_DEPLOY_ENV === "production" || process.env.VERCEL_ENV === "production";
const requireHubActive = process.env.RELAY_FAQ_REQUIRE_HUB_ACTIVE
  ? process.env.RELAY_FAQ_REQUIRE_HUB_ACTIVE === "true"
  : production;
const token = args.has("--snapshot") ? undefined : process.env.NOTION_FAQ_TOKEN;
const dryRun = args.has("--dry-run");

const paths = await listPublicPaths();
const routeExists = (path: string) => paths.has(path);

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!dryRun && (!url || !secretKey)) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY are required (or pass --dry-run).");
  process.exit(2);
}
const store = !dryRun && url && secretKey ? new SupabaseRelayStore({ url, secretKey }) : null;

let mode: "snapshot" | "full" | "incremental" = "snapshot";
let hubActive: boolean;
let mapped: FaqMapped[];
let since: string | undefined;

if (token) {
  const reader = new NotionFaqReader({
    token,
    dataSourceId: process.env.NOTION_FAQ_DATA_SOURCE_ID || FAQ_DATA_SOURCE_ID,
    hubPageId: process.env.NOTION_FAQ_HUB_PAGE_ID || FAQ_HUB_PAGE_ID,
    ...(process.env.NOTION_API_VERSION ? { notionVersion: process.env.NOTION_API_VERSION } : {}),
  });
  const previous = store
    ? (await store.lastSyncRuns("faq", 5)).filter((r) => r.mode !== "snapshot")
    : [];
  const lastGood = previous.find((r) => r.finishedAt && r.errors.length === 0);
  mode = args.has("--full") || !lastGood?.finishedAt ? "full" : "incremental";
  if (mode === "incremental" && lastGood?.finishedAt)
    since = new Date(Date.parse(lastGood.finishedAt) - 2 * 60_000).toISOString();
  hubActive = await reader.hubActive();
  const { rows } = await reader.rows(since);
  mapped = rows.map((row) => mapFaqRow(row, { routeExists, requireHubActive, hubActive }));
} else {
  hubActive = faqSnapshot.hubStatus === "Active";
  mapped = faqEntriesFromSnapshot({ routeExists, requireHubActive }).mapped;
}

const verified = mapped.filter((m) => m.verified);
const held = mapped.filter((m) => m.held.length > 0);
const published = mapped.filter((m) => m.entry.status === "published");
console.log(
  `FAQ sync (${mode}${since ? ` since ${since}` : ""}): ${mapped.length} rows, ${verified.length} Verified, ` +
    `${published.length} publishable, ${held.length} held; hub gate ${requireHubActive ? "on" : "off"}` +
    `, hub page ${hubActive ? "Active" : "not Active"}`,
);
for (const h of held) console.log(`  held ${h.entry.externalId}: ${h.held.join(", ")}`);
if (requireHubActive && published.length === 0 && verified.length > 0)
  console.log("  nothing is published: the Master FAQ hub page is not Active");

if (!store) process.exit(0);

const embedder =
  process.env.RELAY_EMBED_FUNCTION_URL && process.env.RELAY_EMBED_SECRET
    ? new HttpEmbedder({
        url: process.env.RELAY_EMBED_FUNCTION_URL,
        secret: process.env.RELAY_EMBED_SECRET,
        defaultTimeoutMs: 60_000,
      })
    : nullEmbedder;

const run = await store.startSyncRun("faq", mode);
try {
  const result = await ingestEntries(
    store,
    embedder,
    mapped.map((m) => m.entry),
    {
      archiveMissingFor: mode === "incremental" ? [] : ["faq"],
      repairEmbeddings: mode !== "incremental",
      updatedBy: "relay:faq-sync",
    },
  );
  await store.finishSyncRun({
    ...run,
    finishedAt: new Date().toISOString(),
    added: result.added,
    updated: result.updated,
    archived: result.archived,
    held: held.length,
    skippedUnverified: mapped.length - verified.length,
    errors: result.errors,
  });
  console.log(
    `ingest: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged, ` +
      `${result.archived} archived; ${result.chunks} chunks, ${result.embedded} embedded`,
  );
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`  error ${e}`);
    process.exit(1);
  }
} catch (error) {
  await store.finishSyncRun({
    ...run,
    finishedAt: new Date().toISOString(),
    errors: [error instanceof Error ? error.name : "sync_failed"],
  });
  console.error(`FAQ sync failed: ${error instanceof Error ? error.name : "unknown error"}`);
  process.exit(1);
}
