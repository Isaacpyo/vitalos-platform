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

export type Block =
  | { type: "heading"; text: string; missing?: string | undefined }
  | { type: "section"; text: string }
  | { type: "text"; text: string; tone?: "muted" | undefined; missing?: string | undefined }
  | { type: "button"; label: string; url: string }
  | { type: "badge"; items: (string | { text: string; tone?: BadgeTone | undefined })[] }
  | { type: "quote"; text: string; missing?: string | undefined }
  | { type: "details"; rows: DetailRow[] }
  | { type: "divider" }
  | { type: "signature"; name: string; title?: string | undefined };

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
  company: CompanyFacts;
  /** Marketing and outreach only (UK GDPR/PECR): why they get it, and how to stop. */
  unsubscribe?: { reason: string; url: string } | undefined;
}

export interface EmailDocument {
  /** The `<title>`, normally the subject. */
  title: string;
  preheader: string;
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

function textHtml(text: string, muted: boolean): string {
  const groups = textGroups(text);
  return groups
    .map((group, index) => {
      const margin = index === groups.length - 1 ? "0" : "0 0 12px";
      if (group.list) {
        const items = group.lines.map((line) => fill("list_item", { text: e(line) })).join("");
        return fill("list", { margin, items });
      }
      return fill(muted ? "paragraph_muted" : "paragraph", {
        margin,
        text: group.lines.map(e).join("<br>\n"),
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
  }
}

/** Space above a block, in px. A block right after a section title sits under it. */
function blockPad(block: Block, previous: Block | undefined): number {
  if (!previous || previous.type === "section") return 0;
  if (block.type === "section") return 28;
  if (block.type === "badge") return 12;
  if (block.type === "text" && previous.type === "heading") return 4;
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

function footerHtml(footer: FooterInput): { html: string; images: InlineImage[] } {
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

  const lines = companyLines(footer.company);
  const filled = pickFilled(footer.company);
  const website = filled.website ?? "";
  const support = filled.supportEmail ?? "";
  const websiteHtml =
    website && isSafeUrl(website)
      ? fill("footer_link", { href: e(website), text: e(displayUrl(website)) })
      : e(website || COMPANY_PLACEHOLDERS.website);
  const supportHtml = support
    ? fill("footer_link", { href: e(`mailto:${support}`), text: e(support) })
    : e(COMPANY_PLACEHOLDERS.supportEmail);
  rows.push(
    fill("footer_text", {
      pad: social.length > 0 ? "8" : "16",
      text: `${e(lines.company)}<br>${e(lines.office)}<br>${websiteHtml} · ${supportHtml}`,
    }),
  );

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

export function renderHtml(doc: EmailDocument): { html: string; images: InlineImage[] } {
  const body = doc.blocks
    .map((block, index) =>
      fill("row", {
        pad: String(blockPad(block, doc.blocks[index - 1])),
        content: blockHtml(block),
      }),
    )
    .join("\n");
  const footer = footerHtml(doc.footer);
  const html = fill("shell", {
    title: e(cleanLine(doc.title)),
    style_blocks: STYLE_BLOCKS.map((css) => fill("style", { css })).join("\n"),
    preheader: e(cleanLine(doc.preheader)) + PREHEADER_PAD,
    header: fill("header", {
      logo: imageHtml(inlineImages.logo, "Vitalos"),
      label: e(cleanLine(doc.headerLabel)),
    }),
    body,
    footer: footer.html,
  });
  return { html, images: [inlineImages.logo, ...footer.images] };
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
  }
}

function footerText(footer: FooterInput): string {
  const parts: string[] = ["--"];
  const notice = cleanMultiline(footer.notice);
  if (notice) parts.push(notice, "");
  const social = footer.social.filter((s) => imageById(s.contentId) && isSafeUrl(cleanLine(s.url)));
  if (social.length > 0) {
    parts.push(...social.map((s) => `${cleanLine(s.label)}: ${cleanLine(s.url)}`), "");
  }
  const lines = companyLines(footer.company);
  const filled = pickFilled(footer.company);
  parts.push(
    lines.company,
    lines.office,
    `${filled.website ? displayUrl(filled.website) : COMPANY_PLACEHOLDERS.website} · ${filled.supportEmail ?? COMPANY_PLACEHOLDERS.supportEmail}`,
  );
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

/** The plain-text part: every block, in the same order as the HTML. */
export function renderText(doc: EmailDocument): string {
  const chunks: string[] = [`VITALOS · ${cleanLine(doc.headerLabel).toUpperCase()}`];
  doc.blocks.forEach((block, index) => {
    const separator = doc.blocks[index - 1]?.type === "section" ? "\n" : "\n\n";
    chunks.push(separator, blockText(block));
  });
  chunks.push("\n\n", footerText(doc.footer));
  return chunks.join("");
}

export function renderEmail(doc: EmailDocument): RenderedEmail {
  const { html, images } = renderHtml(doc);
  return { html, text: renderText(doc), inlineImages: images };
}
