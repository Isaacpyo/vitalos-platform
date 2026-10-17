/**
 * pnpm relay:ingest [--dry-run] [--force] [--faq snapshot|skip]
 *
 * Indexes the bundled knowledge (repo seed, website content, Master FAQ snapshot) into the
 * `relay` schema. Idempotent by checksum: unchanged entries are skipped, changed ones are
 * re-chunked and re-embedded, and repo/CMS entries that disappeared are archived.
 *
 * Environment: SUPABASE_URL, SUPABASE_SECRET_KEY (required unless --dry-run);
 * RELAY_EMBED_FUNCTION_URL + RELAY_EMBED_SECRET (optional: without them chunks get no embedding
 * and retrieval runs on full text); RELAY_FAQ_REQUIRE_HUB_ACTIVE (default true when
 * VITALOS_DEPLOY_ENV/VERCEL_ENV is production); NOTION_FAQ_TOKEN (when set the live sync owns the
 * FAQ, so the snapshot is skipped unless --faq snapshot is passed).
 */
import {
  HttpEmbedder,
  SupabaseRelayStore,
  ingestEntries,
  nullEmbedder,
} from "@vitalos/relay-core/knowledge";
import type { KbSource } from "@vitalos/relay-core/knowledge";
import { allBundledEntries } from "../index";

const args = new Set(process.argv.slice(2));
const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const production =
  process.env.VITALOS_DEPLOY_ENV === "production" || process.env.VERCEL_ENV === "production";
const requireHubActive = process.env.RELAY_FAQ_REQUIRE_HUB_ACTIVE
  ? process.env.RELAY_FAQ_REQUIRE_HUB_ACTIVE === "true"
  : production;
const faqMode = flag("faq") ?? (process.env.NOTION_FAQ_TOKEN ? "skip" : "snapshot");

const { entries, publicPaths } = await allBundledEntries({
  requireHubActive,
  includeFaqSnapshot: faqMode === "snapshot",
});

const bySource = new Map<
  string,
  { total: number; published: number; draft: number; archived: number }
>();
for (const e of entries) {
  const s = bySource.get(e.source) ?? { total: 0, published: 0, draft: 0, archived: 0 };
  s.total += 1;
  s[e.status] += 1;
  bySource.set(e.source, s);
}
console.log(
  `public site paths: ${publicPaths.size}; FAQ: ${faqMode}; hub gate: ${requireHubActive ? "on" : "off"}`,
);
for (const [source, s] of bySource) {
  console.log(
    `  ${source.padEnd(12)} ${s.total} entries (${s.published} published, ${s.draft} draft, ${s.archived} archived)`,
  );
}

if (args.has("--dry-run")) process.exit(0);

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY are required (or pass --dry-run).");
  process.exit(2);
}
const store = new SupabaseRelayStore({ url, secretKey });
const embedder =
  process.env.RELAY_EMBED_FUNCTION_URL && process.env.RELAY_EMBED_SECRET
    ? new HttpEmbedder({
        url: process.env.RELAY_EMBED_FUNCTION_URL,
        secret: process.env.RELAY_EMBED_SECRET,
        defaultTimeoutMs: 60_000,
      })
    : nullEmbedder;
if (!embedder.enabled)
  console.log(
    "no embedding function configured: chunks are stored without embeddings (full-text retrieval only)",
  );

const archiveMissingFor: KbSource[] = [
  "repo",
  "cms",
  ...(faqMode === "snapshot" ? (["faq"] as const) : []),
];
const started = Date.now();
// One sync run per bundled source, so the admin knowledge page shows when it last ran (D4).
const runs = await Promise.all(
  (["cms", "repo"] as const).map((s) => store.startSyncRun(s, "full")),
);
const result = await ingestEntries(store, embedder, entries, {
  archiveMissingFor,
  force: args.has("--force"),
  repairEmbeddings: true,
  updatedBy: "relay:ingest",
});
for (const run of runs)
  await store.finishSyncRun({
    ...run,
    finishedAt: new Date().toISOString(),
    errors: result.errors.filter((e) => e.startsWith(`${run.source}:`)).slice(0, 20),
  });
console.log(
  `ingest: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged (${result.repaired} re-embedded), ${result.archived} archived; ` +
    `${result.chunks} chunks, ${result.embedded} embedded in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
if (result.errors.length > 0) {
  for (const e of result.errors) console.error(`  error ${e}`);
  process.exit(1);
}
