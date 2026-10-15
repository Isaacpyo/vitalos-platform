/**
 * Builds faq/master-faq.snapshot.json from a Master FAQ export so deploys work without Notion.
 *
 *   pnpm --filter @vitalos/relay-knowledge faq-snapshot -- \
 *     --export ~/Documents/vitalos-faq/faq-master.json \
 *     --index <file of "ID pageIdSuffix status ..." lines from Notion> --hub Draft
 *
 * Safety (Relay follow-up, rule 2): the snapshot holds ONLY Verified entries that pass every hold
 * rule after [CONFIRM: …] blocks are stripped. `Source` and `Confirm note` are dropped. Needs
 * confirmation and held entries are listed by id, section and reasons only, never their text.
 * The raw export is never committed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  holdReasons,
  normaliseWhitespace,
  stripConfirmBlocks,
} from "@vitalos/relay-core/knowledge";
import type { FaqRow } from "@vitalos/relay-core/knowledge";
import { FAQ_DATA_SOURCE_ID, SNAPSHOT_VERSION } from "../src/faq";
import type { FaqSnapshot } from "../src/faq";

interface ExportEntry {
  id: string;
  section: string;
  question: string;
  shortAnswer: string | null;
  fullAnswer: string | null;
  audienceTags: string[] | null;
  pagePlacement: string[] | null;
  linkedOfferCta: string | null;
  status: "Verified" | "Needs confirmation";
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const exportPath = arg("export");
const indexPath = arg("index");
const hub = arg("hub") ?? "Draft";
if (!exportPath || !indexPath) {
  console.error(
    "usage: build-faq-snapshot --export <faq-master.json> --index <notion index> [--hub Draft|Active]",
  );
  process.exit(2);
}

const exported = (JSON.parse(readFileSync(exportPath, "utf8")) as { entries: ExportEntry[] })
  .entries;
// Index lines from Notion: "ID <32-hex page id> V|N <question len> <short len> <full len>",
// separated by newlines or ";". Lengths are compared with the export so a stale export fails.
const pageIds = new Map<string, { pageId: string; status: string; lengths: number[] }>();
for (const line of readFileSync(indexPath, "utf8").split(/[;\r\n]+/)) {
  const [id, hex, status, ...lens] = line.trim().split(/\s+/);
  if (!id || !hex || !status) continue;
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`bad page id for ${id}`);
  const pageId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  pageIds.set(id, {
    pageId,
    status: status === "V" ? "Verified" : "Needs confirmation",
    lengths: lens.map(Number),
  });
}
const charLength = (value: string | null) => [...(value ?? "")].length;
const drifted: { id: string; reason: string }[] = [];
for (const id of pageIds.keys()) {
  if (!exported.some((e) => e.id === id))
    drifted.push({ id, reason: "in Notion, not in the export" });
}

const entries: FaqRow[] = [];
const needsConfirmation: FaqSnapshot["needsConfirmation"] = [];
const held: FaqSnapshot["held"] = [];

for (const e of exported) {
  const ref = pageIds.get(e.id);
  if (!ref) {
    drifted.push({ id: e.id, reason: "in the export, not in Notion" });
    continue;
  }
  if (ref.status !== e.status) {
    drifted.push({ id: e.id, reason: `status: export ${e.status}, Notion ${ref.status}` });
    continue;
  }
  const lengths = [charLength(e.question), charLength(e.shortAnswer), charLength(e.fullAnswer)];
  const utf16 = [e.question, e.shortAnswer ?? "", e.fullAnswer ?? ""].map((v) => v.length);
  if (ref.lengths.length === 3 && ref.lengths.some((n, i) => n !== lengths[i] && n !== utf16[i])) {
    drifted.push({ id: e.id, reason: "text differs between the export and Notion" });
    continue;
  }
  const notionUrl = `https://app.notion.com/p/${ref.pageId.replace(/-/g, "")}`;
  if (e.status !== "Verified") {
    needsConfirmation.push({ id: e.id, section: e.section, notionPageId: ref.pageId, notionUrl });
    continue;
  }
  const question = stripConfirmBlocks(normaliseWhitespace(e.question));
  const shortAnswer = stripConfirmBlocks(normaliseWhitespace(e.shortAnswer ?? ""));
  const fullAnswer = stripConfirmBlocks(normaliseWhitespace(e.fullAnswer ?? ""));
  const reasons = holdReasons([question, shortAnswer, fullAnswer].join("\n"));
  if (!shortAnswer) reasons.push("empty short answer");
  if (reasons.length > 0) {
    held.push({ id: e.id, section: e.section, notionPageId: ref.pageId, notionUrl, reasons });
    continue;
  }
  entries.push({
    notionPageId: ref.pageId,
    notionUrl,
    lastEditedAt: null,
    id: e.id,
    question,
    section: e.section,
    shortAnswer,
    fullAnswer,
    status: "Verified",
    pagePlacement: [...new Set((e.pagePlacement ?? []).filter((p) => p.startsWith("/")))],
    linkedOfferCta: e.linkedOfferCta,
    audienceTags: e.audienceTags ?? [],
    source: null,
    confirmNote: null,
  });
}

const snapshot: FaqSnapshot = {
  version: SNAPSHOT_VERSION,
  generatedAt: new Date().toISOString(),
  from: "export-verified-against-notion",
  dataSourceId: FAQ_DATA_SOURCE_ID,
  hubStatus: hub === "Active" ? "Active" : "Draft",
  counts: {
    total: exported.length,
    verified: exported.filter((e) => e.status === "Verified").length,
    needsConfirmation: needsConfirmation.length,
    held: held.length,
    live: entries.length,
  },
  entries: entries.sort((a, b) => a.id.localeCompare(b.id)),
  needsConfirmation: needsConfirmation.sort((a, b) => a.id.localeCompare(b.id)),
  held: held.sort((a, b) => a.id.localeCompare(b.id)),
  drifted: drifted.sort((a, b) => a.id.localeCompare(b.id)),
};

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../faq/master-faq.snapshot.json");
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `snapshot: ${snapshot.counts.live} live, ${snapshot.counts.held} held, ${snapshot.counts.needsConfirmation} need confirmation (of ${snapshot.counts.total})`,
);
for (const h of held) console.log(`held ${h.id}: ${h.reasons.join("; ")}`);
for (const d of drifted) console.log(`left out ${d.id}: ${d.reason}`);
