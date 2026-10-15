import { checksumOf } from "./checksum";
import type { KnowledgeEntry } from "./types";
import type { NextStep } from "../contract";

/**
 * Master FAQ (Notion) mapping and safety rules (Relay follow-up, sections 2 and 6).
 *
 * Hard rules:
 * - only Status = Verified is ever publishable; Needs confirmation entries become admin-only
 *   records with no chunks;
 * - every [CONFIRM: …] block is removed from all text, then entries still carrying internal
 *   markers, amounts, stage references or banned words are HELD (never published);
 * - `Source` and `Confirm note` live in admin metadata only;
 * - Notion text is plain data: rich text is flattened to plain text and whitespace normalised.
 */

export type FaqStatus = "Verified" | "Needs confirmation";

/** One Master FAQ row, already flattened to plain text. */
export interface FaqRow {
  notionPageId: string | null;
  notionUrl: string | null;
  lastEditedAt: string | null;
  id: string;
  question: string;
  section: string;
  shortAnswer: string;
  fullAnswer: string;
  status: FaqStatus;
  pagePlacement: string[];
  linkedOfferCta: string | null;
  audienceTags: string[];
  source: string | null;
  confirmNote: string | null;
}

export const BANNED_WORDS = [
  "revolutionary",
  "cutting-edge",
  "unleash",
  "supercharge",
  "magic",
  "ai-powered",
] as const;

/** Joins Notion rich-text items into plain text (no formatting, links or HTML). */
export function plainText(items: readonly { plain_text?: unknown }[] | null | undefined): string {
  return normaliseWhitespace(
    (items ?? []).map((i) => (typeof i.plain_text === "string" ? i.plain_text : "")).join(""),
  );
}

export function normaliseWhitespace(value: string): string {
  return value
    .replace(
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u202A-\u202E\u2066-\u2069]/g,
      "",
    )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00A0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Removes every `[CONFIRM: …]` block, including nested brackets and line breaks. An unclosed
 * block removes the rest of the text (fail closed: nothing after an unterminated internal note
 * can be trusted).
 */
export function stripConfirmBlocks(value: string): string {
  let out = "";
  let i = 0;
  const re = /\[\s*CONFIRM\s*:/gi;
  while (i < value.length) {
    re.lastIndex = i;
    const m = re.exec(value);
    if (!m) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    while (j < value.length && depth > 0) {
      const ch = value[j];
      if (ch === "[") depth += 1;
      else if (ch === "]") depth -= 1;
      j += 1;
    }
    i = depth === 0 ? j : value.length;
  }
  return normaliseWhitespace(out.replace(/ +([.,;:])/g, "$1"));
}

/** Reasons an entry is held back after stripping (empty array = publishable). */
export function holdReasons(text: string): string[] {
  const reasons: string[] = [];
  const lower = text.toLowerCase();
  // Internal markers are upper case; ordinary prose ("checks confirm that…") is not a marker.
  if (/\bCONFIRM\b/.test(text)) reasons.push("contains CONFIRM");
  if (/\bTODO\b/.test(text)) reasons.push("contains TODO");
  if (/\bTBC\b/.test(text)) reasons.push("contains TBC");
  if (/\[[A-Z][A-Z0-9 _-]{2,}\]/.test(text)) reasons.push("contains a bracketed placeholder");
  if (/[£$€]\s?\d/.test(text)) reasons.push("contains a currency amount");
  if (/day[\s-]rates?/i.test(text)) reasons.push('mentions "day rate"');
  if (/\bS(0[1-9]|1\d|20)\b/.test(text) || text.includes("§"))
    reasons.push("contains an internal stage reference");
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) reasons.push(`uses the banned word "${word}"`);
  }
  return reasons;
}

/** Section number from a label such as "10. Trust Centre" (99 when absent). */
export function sectionOrder(section: string): number {
  const m = /^(\d{1,2})\./.exec(section.trim());
  return m ? Number(m[1]) : 99;
}

/**
 * Citation link: the most specific (longest) placement, ignoring /people/... unless it is the only
 * one, linked only when the route exists on the site.
 */
export function canonicalPath(
  placements: readonly string[],
  routeExists: (path: string) => boolean,
): string | null {
  const nonPeople = placements.filter((p) => !p.startsWith("/people/"));
  const candidates = (nonPeople.length > 0 ? nonPeople : [...placements]).sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );
  return candidates.find((p) => routeExists(p)) ?? null;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * "NEXT STEP" for a Linked offer / CTA value (follow-up section 9). Null when there is no row:
 * "Talk to Vitalos" alone, or a target route that does not exist.
 */
export function nextStepFor(
  cta: string | null,
  routeExists: (path: string) => boolean,
): NextStep | null {
  if (!cta) return null;
  const [first, second] = cta.split("/").map((part) => part.trim());
  if (!first || first === "Talk to Vitalos") return null;
  if (first === "AI Opportunity Assessment" && second === "Start an AI Opportunity Assessment") {
    const href = "/offers/ai-opportunity-assessment";
    return routeExists(href)
      ? { kind: "link", label: "Start an AI Opportunity Assessment", href }
      : null;
  }
  if (first === "Explore Labs") {
    return routeExists("/labs") ? { kind: "link", label: "Explore Labs", href: "/labs" } : null;
  }
  if (/^Discuss (a|an) /.test(first)) return { kind: "handoff", label: first };
  const href = `/offers/${slugify(first)}`;
  return routeExists(href) ? { kind: "link", label: first, href } : null;
}

/** Bump when the FAQ embedding text changes, so the next ingest re-embeds every entry. */
export const FAQ_EMBEDDING_VERSION = 2;

export interface FaqMapOptions {
  routeExists: (path: string) => boolean;
  /** Production with RELAY_FAQ_REQUIRE_HUB_ACTIVE and a Draft hub page: publish nothing. */
  requireHubActive: boolean;
  hubActive: boolean | null;
  owner?: string;
}

export interface FaqMapped {
  entry: KnowledgeEntry;
  held: string[];
  verified: boolean;
}

/**
 * Maps one row to a knowledge entry. Needs-confirmation and held entries keep only admin-visible
 * text (no chunks are created for them; see ingest); Verified, clean entries become one chunk.
 */
export function mapFaqRow(row: FaqRow, options: FaqMapOptions): FaqMapped {
  const question = stripConfirmBlocks(normaliseWhitespace(row.question));
  const shortAnswer = stripConfirmBlocks(normaliseWhitespace(row.shortAnswer));
  const fullAnswer = stripConfirmBlocks(normaliseWhitespace(row.fullAnswer));
  const verified = row.status === "Verified";
  const held = verified ? holdReasons([question, shortAnswer, fullAnswer].join("\n")) : [];
  const gateOpen = !options.requireHubActive || options.hubActive === true;
  const publishable = verified && held.length === 0;
  const placements = [...new Set(row.pagePlacement.filter((p) => p.startsWith("/")))];
  const canonical = canonicalPath(placements, options.routeExists);
  const nextStep = nextStepFor(row.linkedOfferCta, options.routeExists);
  const bodyMd = publishable ? `${shortAnswer}\n\n${fullAnswer}` : "";
  const status = publishable ? (gateOpen ? "published" : "draft") : verified ? "draft" : "archived";

  const entry: KnowledgeEntry = {
    source: "faq",
    sourceRef: row.notionPageId ? `notion:${row.notionPageId}` : `faq:${row.id}`,
    externalId: row.id,
    title: publishable ? question : stripConfirmBlocks(row.question),
    url: canonical,
    type: "faq",
    bodyMd,
    status,
    owner: options.owner ?? "Temitope Agbola",
    reviewDate: null,
    meta: {
      section: row.section,
      section_order: sectionOrder(row.section),
      page_placements: placements,
      canonical_path: canonical,
      linked_cta: row.linkedOfferCta,
      next_step: nextStep,
      audience_tags: row.audienceTags,
      faq_status: row.status,
      ...(row.notionUrl ? { notion_url: row.notionUrl } : {}),
      notion_last_edited_at: row.lastEditedAt,
    },
    adminMeta: {
      source_refs: row.source ?? "",
      confirm_note: row.confirmNote,
      hold_reasons: held,
      ...(verified ? {} : { needs_confirmation: true }),
      ...(publishable && !gateOpen ? { awaiting_sign_off: true } : {}),
    },
    chunks: publishable
      ? [
          {
            heading: question,
            content: `${shortAnswer}\n\n${fullAnswer}`,
            // Question and short answer only: gte-small reads 512 tokens, and long full answers
            // dilute the match with visitors' short questions. The full answer stays searchable
            // through full text and is what the model reads.
            embeddingText: `${question}\n${shortAnswer}`,
          },
        ]
      : [],
    checksum: "",
  };
  entry.checksum = checksumOf({
    embedding: FAQ_EMBEDDING_VERSION,
    question,
    shortAnswer,
    fullAnswer,
    status: row.status,
    placements,
    cta: row.linkedOfferCta,
    gate: gateOpen,
    held,
    canonical,
  });
  return { entry, held, verified };
}
