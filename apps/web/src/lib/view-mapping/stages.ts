import type { RichText, RichTextBlock } from "@vitalos/cms";
import { richTextToPlainText } from "../cms/rich-text";

/**
 * The How We Work page shows the delivery stages in the order the spec fixes (locked copy,
 * Stage 8 section 17). The description of each stage is authored in Sanity: in the route page
 * body, a heading (h2 to h4) whose text is the stage name starts a stage, and the blocks up to the
 * next stage heading are its description. Convention only: editors write the stage name as a
 * heading and describe it underneath; nothing is generated here.
 *
 *  - Every locked stage is returned, in locked order, whether or not it has a description.
 *  - Blocks before the first stage heading are `lead`: the page's own introduction.
 *  - Anything else under a stage heading (including non-stage headings) belongs to that stage.
 */
export interface DerivedStage {
  title: string;
  /** Plain-text description from the CMS, if the editors wrote one. */
  summary?: string;
}

export interface DerivedStages {
  stages: DerivedStage[];
  /** Body blocks that precede the first stage heading. */
  lead: RichText;
}

const HEADING_STYLES = new Set(["h2", "h3", "h4"]);

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

function headingText(block: RichTextBlock): string | undefined {
  if (block._type !== "block" || typeof block["style"] !== "string") return undefined;
  if (!HEADING_STYLES.has(block["style"])) return undefined;
  return normalise(richTextToPlainText([block]));
}

export function deriveStages(
  body: RichText | undefined,
  stageNames: readonly string[],
): DerivedStages {
  const blocks = body ?? [];
  const byName = new Map(stageNames.map((name, index) => [normalise(name), index]));
  const described = new Map<number, RichTextBlock[]>();
  const lead: RichTextBlock[] = [];
  let current: number | undefined;

  for (const block of blocks) {
    const text = headingText(block);
    const stageIndex = text === undefined ? undefined : byName.get(text);
    if (stageIndex !== undefined) {
      current = stageIndex;
      if (!described.has(stageIndex)) described.set(stageIndex, []);
      continue;
    }
    if (current === undefined) lead.push(block);
    else described.get(current)?.push(block);
  }

  const stages = stageNames.map((title, index): DerivedStage => {
    const summary = richTextToPlainText(described.get(index) ?? []).trim();
    return summary ? { title, summary } : { title };
  });
  return { stages, lead };
}
