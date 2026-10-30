import { cleanLine, cleanMultiline, escapeHtml } from "./escape";
import { inlineImages } from "./images";
import type { InlineImage } from "./images";
import { snippets } from "./snippets";
import type { SnippetName } from "./snippets";
import { PREHEADER_PAD, STYLE_BLOCKS } from "./theme";

/**
 * Renders a Vitalos email from blocks: HTML, plain text and the inline images to attach.
 *
 * This file is mirrored line for line by the Super Admin's Python renderer. Any change here must
 * be made there too; the golden fixtures (`superadmin/email-layout/fixtures`) fail otherwise.
 * Values in blocks are plain text: they are cleaned and escaped here.
 */

export type BadgeTone = "intent" | "time" | "none";

export interface DetailRow {
  label: string;
  value: string;
  /** Links the value (`https:` or `mailto:` only). */
  href?: string | undefined;
  /** Small monospace text after the value, in brackets (e.g. a raw value). */
  note?: string | undefined;
  /** Small monospace text on its own line under the value (e.g. a raw timestamp). */
  subvalue?: string | undefined;
  /** Plain-text label for `subvalue`: "Received (raw): …". Defaults to "detail". */
  subvalueLabel?: string | undefined;
  /** A warning pill under the value (e.g. "Personal email domain"). */
  hint?: string | undefined;
  /** Shows the value in a copyable monospace box. */
  code?: boolean | undefined;
  /** Text shown when the value is empty. Defaults to "Not provided". */
  missing?: string | undefined;
}

/** One entry in an `items` list: a digest row, an alert line or a newsletter story. */
export interface ListItem {
  /** A short pill above the title (e.g. "New enquiry", "Possible duplicate"). */
  tag?: string | undefined;
  title: string;
  /** One or two lines of summary. */
  summary?: string | undefined;
  /** A small muted line (e.g. "From Alex Example · 26 Oct 2026, 09:12"). */
  meta?: string | undefined;
  /** Links the title (`https:` or `mailto:` only). */
  href?: string | undefined;
}

/** One figure in a `stats` block. A status is always written as a word, never a colour alone. */
export interface Stat {
  value: string;
  label: string;
}

export type Block =
  | { type: "heading"; text: string; missing?: string | undefined }
  | { type: "section"; text: string }
  | { type: "text"; text: string; tone?: "muted" | undefined; missing?: string | undefined }
  | { type: "button"; label: string; url: string }
  | { type: "badge"; items: (string | { text: string; tone?: BadgeTone | undefined })[] }
  | { type: "quote"; text: string; missing?: string | undefined }
  | { type: "details"; rows: DetailRow[] }
  | { type: "divider" }
  | { type: "signature"; name: string; title?: string | undefined }
  /** A verification code. It must never appear in the subject or preheader. */
  | { type: "code"; code: string; expiry?: string | undefined; missing?: string | undefined }
  /** "What happens next": 1 to 4 numbered steps, with an optional title. */
  | { type: "steps"; title?: string | undefined; items: string[] }
  | { type: "items"; items: ListItem[] }
  /** 2 to 4 figures with labels. */
  | { type: "stats"; items: Stat[] };

/** The block types a correspondence email (a person writing to a person) may use. */
export const CORRESPONDENCE_BLOCKS: readonly Block["type"][] = [
  "text",
  "quote",
  "divider",
  "signature",
];

export interface SocialLink {
  label: string;
  url: string;
  /** Content id of the icon in `inlineImages`. */
  contentId: string;
}

export interface CompanyFacts {
  legalName?: string | undefined;
  companyNumber?: string | undefined;
  registeredOffice?: string | undefined;
  website?: string | undefined;
  supportEmail?: string | undefined;
}

export interface FooterInput {
  /** A line above everything else, e.g. the internal-notification note. */
  notice?: string | undefined;
  social: SocialLink[];
  /** A product line right above the company facts, e.g. "Askbridge by Vitalos". */
  product?: string | undefined;
  company: CompanyFacts;
  /** Marketing and outreach only (UK GDPR/PECR): why they get it, and how to stop. */
  unsubscribe?: { reason: string; url: string } | undefined;
}

export interface EmailDocument {
  /**
   * `correspondence`: a person writing to a person (an inbox reply). No header band, label or
   * badges; body paragraphs and a signature; a compact footer with the company facts only.
   */
  mode?: "standard" | "correspondence" | undefined;
  /** The `<title>`, normally the subject. */
  title: string;
  preheader: string;
  /** The header pill. Not shown in correspondence mode. */
  headerLabel: string;
  blocks: Block[];
  footer: FooterInput;
}

export interface RenderedEmail {
  html: string;
  text: string;
  /** Images the HTML references as `cid:`; send them as inline attachments. */
  inlineImages: InlineImage[];
}

export const NOT_PROVIDED = "Not provided";

/** Shown in place of a company fact that settings do not provide. */
export const COMPANY_PLACEHOLDERS: Record<keyof CompanyFacts, string> = {
  legalName: "[Legal name]",
  companyNumber: "[Company number]",
  registeredOffice: "[Registered office]",
  website: "[Website]",
  supportEmail: "[Support email]",
};

const SAFE_URL = /^(https:\/\/|mailto:)[^\s"'<>`]+$/i;

/** Only `https:` and `mailto:` links are rendered; anything else is shown as text. */
export function isSafeUrl(url: string): boolean {
  return SAFE_URL.test(url);
}

/** Fills `[[slot]]` placeholders. Values must already be HTML. */
export function fill(name: SnippetName, slots: Record<string, string>): string {
  return snippets[name].replace(/\[\[([a-z_]+)\]\]/g, (_, key: string) => slots[key] ?? "");
}

const e = (value: string) => escapeHtml(value);

function imageHtml(img: InlineImage, alt: string): string {
  return fill("image", {
    content_id: e(img.contentId),
    width: String(img.width),
    height: String(img.height),
    alt: e(alt),
  });
}

function imageById(contentId: string): InlineImage | undefined {
  return Object.values(inlineImages).find((img) => img.contentId === contentId);
}

/** Groups of lines: runs of "- " lines become lists, other lines a paragraph. */
function textGroups(text: string): { list: boolean; lines: string[] }[] {
  const groups: { list: boolean; lines: string[] }[] = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    let current: { list: boolean; lines: string[] } | undefined;
    for (const line of paragraph.split("\n")) {
      const isItem = line.startsWith("- ");
      const content = isItem ? line.slice(2) : line;
      if (current && current.list === isItem) {
        current.lines.push(content);
      } else {
        current = { list: isItem, lines: [content] };
        groups.push(current);
      }
    }
  }
  return groups;
}

// An https address in a text block runs to whitespace, a quote, a backtick or an angle bracket.
const TEXT_URL = /https:\/\/[^\s"'<>`]+/g;
const HTTPS = "https://";
const TRAILING = ".,;:!?";

const count = (value: string, ch: string) => value.split(ch).length - 1;

/** Sentence punctuation after an address, and a ")" it did not open, stay text. */
function trimUrl(url: string): string {
  let out = url;
  for (;;) {
    const last = out.slice(-1);
    if (last && TRAILING.includes(last)) {
      out = out.slice(0, -1);
    } else if (last === ")" && count(out, "(") < count(out, ")")) {
      out = out.slice(0, -1);
    } else {
      return out;
    }
  }
}

/**
 * Escapes a line of a text block and links each https address in it with the layout's link style,
 * so an email client never shows it in its own default colour (for example the fallback line under
 * a button). Other schemes stay text.
 */
function linkedText(line: string): string {
  let html = "";
  let last = 0;
  for (const match of line.matchAll(TEXT_URL)) {
    const url = trimUrl(match[0]);
    if (url.length <= HTTPS.length) continue;
    html += e(line.slice(last, match.index)) + fill("text_link", { href: e(url), text: e(url) });
    last = match.index + url.length;
  }
  return html + e(line.slice(last));
}

function textHtml(text: string, muted: boolean): string {
  const groups = textGroups(text);
  return groups
    .map((group, index) => {
      const margin = index === groups.length - 1 ? "0" : "0 0 12px";
      if (group.list) {
        const items = group.lines
          .map((line) => fill("list_item", { text: linkedText(line) }))
          .join("");
        return fill("list", { margin, items });
      }
      return fill(muted ? "paragraph_muted" : "paragraph", {
        margin,
        text: group.lines.map(linkedText).join("<br>\n"),
      });
    })
    .join("\n");
}

const missingHtml = (text: string) => fill("missing", { text: e(text) });

function detailValueHtml(row: DetailRow): { html: string; linked: boolean } {
  const value = cleanLine(row.value);
  if (!value) {
    return {
      html: fill("padded", { text: missingHtml(row.missing ?? NOT_PROVIDED) }),
      linked: true,
    };
  }
  const href = row.href ? cleanLine(row.href) : "";
  const linked = Boolean(href && isSafeUrl(href));
  let html = linked
    ? fill("link", { href: e(href), text: e(value) })
    : row.code
      ? fill("code", { text: e(value) })
      : e(value);
  if (row.note) html += fill("note", { text: e(cleanLine(row.note)) });
  if (row.subvalue) {
    // Soft breaks after the date and before the offset keep an ISO timestamp readable on a phone.
    const sub = e(cleanLine(row.subvalue))
      .replace(/T(?=\d)/, "T<wbr>")
      .replace(/([+-]\d\d:\d\d|Z)$/, "<wbr>$1");
    html += fill("subvalue", { text: sub });
  }
  if (row.hint) html += fill("hint", { text: e(cleanLine(row.hint)) });
  return { html, linked };
}

function badgeItems(block: Extract<Block, { type: "badge" }>): { text: string; tone: BadgeTone }[] {
  return block.items
    .map((item, index) => {
      const text = cleanLine(typeof item === "string" ? item : item.text);
      const tone: BadgeTone =
        typeof item === "string" || !item.tone ? (index % 2 === 0 ? "intent" : "time") : item.tone;
      return { text, tone };
    })
    .filter((item) => item.text);
}

function blockHtml(block: Block): string {
  switch (block.type) {
    case "heading": {
      const text = cleanLine(block.text);
      return fill("heading", { text: text ? e(text) : missingHtml(block.missing ?? NOT_PROVIDED) });
    }
    case "section":
      return fill("section", { text: e(cleanLine(block.text)) });
    case "text": {
      const text = cleanMultiline(block.text);
      if (!text) {
        return fill(block.tone === "muted" ? "paragraph_muted" : "paragraph", {
          margin: "0",
          text: missingHtml(block.missing ?? NOT_PROVIDED),
        });
      }
      return textHtml(text, block.tone === "muted");
    }
    case "button": {
      const url = cleanLine(block.url);
      const label = cleanLine(block.label);
      if (!isSafeUrl(url)) {
        return fill("paragraph_muted", { margin: "0", text: e(`${label}: link not available`) });
      }
      return fill("button", { href: e(url), label: e(label) });
    }
    case "badge": {
      const items = badgeItems(block)
        .map((item) => fill(`badge_${item.tone}`, { text: e(item.text) }))
        .join("");
      return fill("badges", { items });
    }
    case "quote": {
      const text = cleanMultiline(block.text);
      return fill("quote", {
        text: text ? e(text).replace(/\n/g, "<br>\n") : missingHtml(block.missing ?? NOT_PROVIDED),
      });
    }
    case "details": {
      const rows = block.rows
        .map((row) => {
          const value = detailValueHtml(row);
          return fill("details_row", {
            label: e(cleanLine(row.label)),
            value: value.html,
            padding: value.linked ? "0" : "12px 0",
          });
        })
        .join("\n");
      return fill("details", { rows });
    }
    case "divider":
      return snippets.divider;
    case "signature": {
      const title = cleanLine(block.title);
      return fill("signature", {
        name: e(cleanLine(block.name) || "Vitalos"),
        title: title ? fill("signature_title", { text: e(title) }) : "",
      });
    }
    case "code": {
      const code = cleanCode(block.code);
      const expiry = cleanLine(block.expiry);
      const box = fill("code_box", {
        code: code ? e(code) : missingHtml(block.missing ?? NOT_PROVIDED),
      });
      return expiry ? `${box}\n${fill("code_expiry", { text: e(expiry) })}` : box;
    }
    case "steps": {
      const title = cleanLine(block.title);
      const rows = stepItems(block)
        .map((text, index) =>
          fill("step_row", {
            pad: index === 0 ? "0" : "8",
            number: String(index + 1),
            text: e(text),
          }),
        )
        .join("\n");
      const steps = fill("steps", { rows });
      return title ? `${fill("section", { text: e(title) })}\n${steps}` : steps;
    }
    case "items": {
      const rows = block.items
        .map((item) => fill("item_row", { content: listItemHtml(item) }))
        .join("\n");
      return fill("items", { rows });
    }
    case "stats": {
      const width = String(Math.floor(100 / Math.max(block.items.length, 1)));
      const cells = block.items
        .map((stat, index) => {
          const value = cleanLine(stat.value);
          return fill("stat_cell", {
            width,
            edge: index === 0 ? "0" : "1",
            value: value ? e(value) : missingHtml(NOT_PROVIDED),
            label: e(cleanLine(stat.label)),
          });
        })
        .join("");
      return fill("stats", { cells });
    }
  }
}

/** A code is shown without spaces, so it copies as one string. */
function cleanCode(code: string | undefined): string {
  return cleanLine(code).replace(/\s+/g, "");
}

function stepItems(block: Extract<Block, { type: "steps" }>): string[] {
  return block.items.map((item) => cleanLine(item)).filter((item) => item);
}

function listItemHtml(item: ListItem): string {
  const parts: string[] = [];
  const tag = cleanLine(item.tag);
  if (tag) parts.push(fill("item_tag", { text: e(tag) }));
  const title = cleanLine(item.title);
  const href = cleanLine(item.href);
  if (!title) {
    parts.push(fill("item_title", { text: missingHtml(NOT_PROVIDED) }));
  } else if (href && isSafeUrl(href)) {
    parts.push(fill("item_title_link", { href: e(href), text: e(title) }));
  } else {
    parts.push(fill("item_title", { text: e(title) }));
  }
  const summary = cleanMultiline(item.summary);
  if (summary) parts.push(fill("item_summary", { text: e(summary).replace(/\n/g, "<br>\n") }));
  const meta = cleanLine(item.meta);
  if (meta) parts.push(fill("item_meta", { text: e(meta) }));
  return parts.join("");
}

/**
 * Rules a document must meet before it renders: a verification code never appears in the subject
 * or preheader (both show in notifications and inbox lists), and correspondence uses only the
 * correspondence blocks.
 */
export function checkDocument(doc: EmailDocument): void {
  const visible = `${cleanLine(doc.title)}\n${cleanLine(doc.preheader)}`;
  for (const block of doc.blocks) {
    if (block.type === "code") {
      const code = cleanCode(block.code);
      if (code && visible.includes(code)) {
        throw new Error("A verification code must not appear in the subject or preheader.");
      }
    }
    if (doc.mode === "correspondence" && !CORRESPONDENCE_BLOCKS.includes(block.type)) {
      throw new Error(`Correspondence email cannot use a ${block.type} block.`);
    }
  }
}

/** Space above a block, in px. A block right after a section title sits under it. */
function blockPad(block: Block, previous: Block | undefined): number {
  if (!previous || previous.type === "section") return 0;
  if (block.type === "section") return 28;
  if (block.type === "badge") return 12;
  // A muted line right under a heading reads as its subtitle (the enquiry email's organisation).
  if (block.type === "text" && previous.type === "heading") return block.tone === "muted" ? 4 : 12;
  if (block.type === "button") return 16;
  return 16;
}

function companyLines(company: CompanyFacts): { company: string; office: string } {
  const c = { ...COMPANY_PLACEHOLDERS, ...pickFilled(company) };
  return {
    company: `${c.legalName}, company number ${c.companyNumber}`,
    office: `Registered office: ${c.registeredOffice}`,
  };
}

function pickFilled(company: CompanyFacts): CompanyFacts {
  return Object.fromEntries(
    Object.entries(company)
      .map(([k, v]) => [k, cleanLine(v as string | undefined)])
      .filter(([, v]) => v),
  ) as CompanyFacts;
}

const displayUrl = (url: string) => url.replace(/^https:\/\//i, "").replace(/\/$/, "");

function footerHtml(footer: FooterInput, compact = false): { html: string; images: InlineImage[] } {
  if (compact) return { html: companyFooterHtml(footer, "16"), images: [] };
  const rows: string[] = [];
  const images: InlineImage[] = [];
  const notice = cleanMultiline(footer.notice);
  if (notice) rows.push(fill("footer_text", { pad: "16", text: e(notice) }));

  const social = footer.social
    .map((s) => ({ ...s, url: cleanLine(s.url), image: imageById(s.contentId) }))
    .filter((s) => s.image && isSafeUrl(s.url));
  if (social.length > 0) {
    const links = social
      .map((s) => {
        images.push(s.image!);
        return fill("footer_social_link", {
          href: e(s.url),
          image: imageHtml(s.image!, `Vitalos on ${cleanLine(s.label)}`),
        });
      })
      .join("");
    rows.push(fill("footer_social", { links }));
  }

  rows.push(companyFooterHtml(footer, social.length > 0 ? "8" : "16"));

  if (footer.unsubscribe) {
    const reason = cleanLine(footer.unsubscribe.reason);
    const url = cleanLine(footer.unsubscribe.url);
    const link = isSafeUrl(url)
      ? fill("footer_link", { href: e(url), text: "Unsubscribe" })
      : e("Unsubscribe: reply to this email with the word unsubscribe");
    rows.push(fill("footer_text", { pad: "12", text: `${e(reason)}<br>${link}` }));
  }
  return { html: rows.join("\n"), images };
}

function companyFooterHtml(footer: FooterInput, pad: string): string {
  const company = footer.company;
  const product = cleanLine(footer.product);
  const lines = companyLines(company);
  const filled = pickFilled(company);
  const website = filled.website ?? "";
  const support = filled.supportEmail ?? "";
  const websiteHtml =
    website && isSafeUrl(website)
      ? fill("footer_link", { href: e(website), text: e(displayUrl(website)) })
      : e(website || COMPANY_PLACEHOLDERS.website);
  const supportHtml = support
    ? fill("footer_link", { href: e(`mailto:${support}`), text: e(support) })
    : e(COMPANY_PLACEHOLDERS.supportEmail);
  return fill("footer_text", {
    pad,
    text: `${product ? `${e(product)}<br>` : ""}${e(lines.company)}<br>${e(lines.office)}<br>${websiteHtml} · ${supportHtml}`,
  });
}

const CARD_EDGE = "border-top:0;border-radius:0 0 12px 12px;";
const CARD_EDGE_ALONE = "border-radius:12px;";

export function renderHtml(doc: EmailDocument): { html: string; images: InlineImage[] } {
  checkDocument(doc);
  const correspondence = doc.mode === "correspondence";
  const body = doc.blocks
    .map((block, index) =>
      fill("row", {
        pad: String(blockPad(block, doc.blocks[index - 1])),
        content: blockHtml(block),
      }),
    )
    .join("\n");
  const footer = footerHtml(doc.footer, correspondence);
  const html = fill("shell", {
    title: e(cleanLine(doc.title)),
    style_blocks: STYLE_BLOCKS.map((css) => fill("style", { css })).join("\n"),
    preheader: e(cleanLine(doc.preheader)) + PREHEADER_PAD,
    header: correspondence
      ? ""
      : fill("header", {
          logo: imageHtml(inlineImages.logo, "Vitalos"),
          label: e(cleanLine(doc.headerLabel)),
        }),
    card_edge: correspondence ? CARD_EDGE_ALONE : CARD_EDGE,
    body,
    footer: footer.html,
  });
  const images = correspondence ? footer.images : [inlineImages.logo, ...footer.images];
  return { html, images };
}

function detailText(row: DetailRow): string[] {
  const value = cleanLine(row.value) || (row.missing ?? NOT_PROVIDED);
  const note = row.note ? ` (${cleanLine(row.note)})` : "";
  const hint = row.hint && cleanLine(row.value) ? ` [${cleanLine(row.hint)}]` : "";
  const lines = [`${cleanLine(row.label)}: ${value}${note}${hint}`];
  if (row.subvalue) {
    lines.push(
      `${cleanLine(row.label)} (${row.subvalueLabel ?? "detail"}): ${cleanLine(row.subvalue)}`,
    );
  }
  return lines;
}

function blockText(block: Block): string {
  switch (block.type) {
    case "heading":
      return cleanLine(block.text) || (block.missing ?? NOT_PROVIDED);
    case "section":
      return cleanLine(block.text).toUpperCase();
    case "text":
      return cleanMultiline(block.text) || (block.missing ?? NOT_PROVIDED);
    case "button": {
      const url = cleanLine(block.url);
      return `${cleanLine(block.label)}: ${isSafeUrl(url) ? url : "link not available"}`;
    }
    case "badge":
      return badgeItems(block)
        .map((item) => item.text)
        .join(" · ");
    case "quote": {
      const text = cleanMultiline(block.text);
      if (!text) return `> ${block.missing ?? NOT_PROVIDED}`;
      return text
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    }
    case "details":
      return block.rows.flatMap(detailText).join("\n");
    case "divider":
      return "----";
    case "signature":
      return ["Kind regards,", cleanLine(block.name) || "Vitalos", cleanLine(block.title)]
        .filter(Boolean)
        .concat("Vitalos Technologies")
        .join("\n");
    case "code": {
      const code = cleanCode(block.code) || (block.missing ?? NOT_PROVIDED);
      const expiry = cleanLine(block.expiry);
      return expiry ? `${code}\n${expiry}` : code;
    }
    case "steps": {
      const title = cleanLine(block.title);
      const steps = stepItems(block).map((text, index) => `${index + 1}. ${text}`);
      return (title ? [title.toUpperCase(), ...steps] : steps).join("\n");
    }
    case "items":
      return block.items.map(listItemText).join("\n\n");
    case "stats":
      return block.items
        .map((stat) => `${cleanLine(stat.label)}: ${cleanLine(stat.value) || NOT_PROVIDED}`)
        .join("\n");
  }
}

function listItemText(item: ListItem): string {
  const tag = cleanLine(item.tag);
  const title = cleanLine(item.title) || NOT_PROVIDED;
  const href = cleanLine(item.href);
  return [
    tag ? `[${tag}] ${title}` : title,
    cleanMultiline(item.summary),
    cleanLine(item.meta),
    href && isSafeUrl(href) ? href : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function footerText(footer: FooterInput, compact = false): string {
  const parts: string[] = ["--"];
  if (compact) return parts.concat(companyText(footer)).join("\n");
  const notice = cleanMultiline(footer.notice);
  if (notice) parts.push(notice, "");
  const social = footer.social.filter((s) => imageById(s.contentId) && isSafeUrl(cleanLine(s.url)));
  if (social.length > 0) {
    parts.push(...social.map((s) => `${cleanLine(s.label)}: ${cleanLine(s.url)}`), "");
  }
  parts.push(...companyText(footer));
  if (footer.unsubscribe) {
    const url = cleanLine(footer.unsubscribe.url);
    parts.push(
      "",
      cleanLine(footer.unsubscribe.reason),
      isSafeUrl(url)
        ? `Unsubscribe: ${url}`
        : "Unsubscribe: reply to this email with the word unsubscribe",
    );
  }
  return parts.join("\n");
}

function companyText(footer: FooterInput): string[] {
  const product = cleanLine(footer.product);
  const lines = companyLines(footer.company);
  const filled = pickFilled(footer.company);
  return [
    ...(product ? [product] : []),
    lines.company,
    lines.office,
    `${filled.website ? displayUrl(filled.website) : COMPANY_PLACEHOLDERS.website} · ${filled.supportEmail ?? COMPANY_PLACEHOLDERS.supportEmail}`,
  ];
}

/** The plain-text part: every block, in the same order as the HTML. */
export function renderText(doc: EmailDocument): string {
  checkDocument(doc);
  const correspondence = doc.mode === "correspondence";
  const chunks: string[] = correspondence
    ? []
    : [`VITALOS · ${cleanLine(doc.headerLabel).toUpperCase()}`];
  doc.blocks.forEach((block, index) => {
    if (index === 0 && correspondence) {
      chunks.push(blockText(block));
      return;
    }
    const separator = doc.blocks[index - 1]?.type === "section" ? "\n" : "\n\n";
    chunks.push(separator, blockText(block));
  });
  chunks.push("\n\n", footerText(doc.footer, correspondence));
  return chunks.join("");
}

export function renderEmail(doc: EmailDocument): RenderedEmail {
  const { html, images } = renderHtml(doc);
  return { html, text: renderText(doc), inlineImages: images };
}
