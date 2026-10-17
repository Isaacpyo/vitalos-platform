import { labMaturityLabels, labsPracticeName, navLabels, practiceDisplayName, routes } from "@vitalos/cms";
import type { LabAssetSummary, PublicationGates, RichText } from "@vitalos/cms";
import type { IconName } from "@vitalos/ui";
import { splitBody } from "./body-sections";
import { firstSentence } from "./text";

/**
 * "How we prove it" (finding B3, 17 Oct 2026): what a visitor can check today, in place of case
 * studies that do not exist yet. Only true things from the repo content are used: the How We Work
 * quality gates, the Labs assets with their maturity labels, the Trust Centre's commitment and,
 * once that section is open, Insights. Every sentence is the first sentence of the page it links
 * to, so nothing is written here, and an item without its source text is left out. No client,
 * outcome, metric or Work page is mentioned.
 */
export interface ProofApproachInput {
  gates: PublicationGates;
  howWeWorkBody?: RichText | undefined;
  labsBody?: RichText | undefined;
  labAssets?: readonly LabAssetSummary[] | undefined;
  trustBody?: RichText | undefined;
  insightsIntro?: string | undefined;
}

export interface ProofApproachItem {
  key: "quality-gates" | "labs" | "trust" | "insights";
  title: string;
  text: string;
  href: string;
  icon: IconName;
  /** A short fact under the title (the Labs maturity labels in use). */
  meta?: string | undefined;
}

/** The section heading: the finding's own name for the pattern (structural, no claim). */
export const proofApproachHeading = "How we prove it";

/** The h2 of the How We Work page that this pattern quotes. */
const QUALITY_GATES = "Quality gates";

/** Structural label in front of the maturity labels a Labs asset carries (Stage 8 §15). */
const MATURITY = "Maturity";

const sectionParagraph = (body: RichText | undefined, title: string): string | undefined =>
  splitBody(body).sections.find((section) => section.title === title)?.paragraphs[0];

/** The last plain paragraph of a body (the Labs page closes on what every asset states). */
const lastParagraph = (body: RichText | undefined): string | undefined => {
  const { lead, sections } = splitBody(body);
  const paragraphs = [lead, ...sections].flatMap((section) => section.paragraphs);
  return paragraphs.at(-1);
};

const firstParagraph = (body: RichText | undefined): string | undefined => {
  const { lead, sections } = splitBody(body);
  return [lead, ...sections].flatMap((section) => section.paragraphs)[0];
};

export function proofApproachItems(input: ProofApproachInput): ProofApproachItem[] {
  const items: ProofApproachItem[] = [];

  const gatesText = firstSentence(sectionParagraph(input.howWeWorkBody, QUALITY_GATES));
  if (gatesText) {
    items.push({
      key: "quality-gates",
      title: QUALITY_GATES,
      text: gatesText,
      href: routes.howWeWork(),
      icon: "check",
    });
  }

  const assets = input.labAssets ?? [];
  const labsText = firstSentence(lastParagraph(input.labsBody));
  if (input.gates.open.labs && assets.length > 0 && labsText) {
    const maturities = [...new Set(assets.map((asset) => labMaturityLabels[asset.maturity]))];
    items.push({
      key: "labs",
      title: practiceDisplayName(labsPracticeName),
      text: labsText,
      href: routes.labs(),
      icon: "flask",
      meta: `${MATURITY}: ${maturities.join(", ")}`,
    });
  }

  const trustText = firstSentence(firstParagraph(input.trustBody));
  if (trustText) {
    items.push({
      key: "trust",
      title: navLabels.trustCentre,
      text: trustText,
      href: routes.trust(),
      icon: "shield",
    });
  }

  const insightsText = firstSentence(input.insightsIntro);
  if (input.gates.open.insights && insightsText) {
    items.push({
      key: "insights",
      title: navLabels.insights,
      text: insightsText,
      href: routes.insights(),
      icon: "document",
    });
  }

  return items;
}
