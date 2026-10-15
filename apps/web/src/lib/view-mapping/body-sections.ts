import type { RichText, RichTextBlock } from "@vitalos/cms";
import { richTextToPlainText } from "../cms/rich-text";

/**
 * A rich-text body split at its h2 headings, for pages that present the body the way the
 * homepage presents items (pages redesign, 15 Oct 2026): a section's paragraphs become a short
 * description and its list items become cards or rows. A section that carries anything plain
 * text cannot hold (links, figures, tables, callouts, h3s) keeps its rich text.
 */
export interface BodySection {
  title?: string | undefined;
  paragraphs: string[];
  items: string[];
  /** The section's own blocks (without its heading), for the rich-text fallback. */
  blocks: RichTextBlock[];
  /** Needs its rich text: it has links or blocks other than plain paragraphs and lists. */
  rich: boolean;
}

export interface SplitBody {
  /** Blocks before the first h2. */
  lead: BodySection;
  sections: BodySection[];
}

const emptySection = (title?: string): BodySection => ({
  ...(title ? { title } : {}),
  paragraphs: [],
  items: [],
  blocks: [],
  rich: false,
});

const hasLinks = (block: RichTextBlock): boolean =>
  Array.isArray(block["markDefs"]) && (block["markDefs"] as unknown[]).length > 0;

export function splitBody(body: RichText | undefined): SplitBody {
  const lead = emptySection();
  const sections: BodySection[] = [];
  let current = lead;
  for (const block of body ?? []) {
    const style = typeof block["style"] === "string" ? block["style"] : "normal";
    const text = block._type === "block" ? richTextToPlainText([block]).trim() : "";
    if (block._type === "block" && style === "h2" && text) {
      current = emptySection(text);
      sections.push(current);
      continue;
    }
    current.blocks.push(block);
    if (block._type !== "block" || (style !== "normal" && !block["listItem"]) || hasLinks(block)) {
      current.rich = true;
      continue;
    }
    if (!text) continue;
    if (block["listItem"]) current.items.push(text);
    else current.paragraphs.push(text);
  }
  return { lead, sections };
}

/** True when every section is plain paragraphs: the body reads as a set of short cards. */
export const isCardBody = ({ sections }: SplitBody): boolean =>
  sections.length > 1 && sections.every((section) => !section.rich && section.items.length === 0);
