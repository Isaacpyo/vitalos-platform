import { howWeWorkStages } from "@vitalos/cms";
import type {
  IndustrySummary,
  LabAssetSummary,
  OfferSummary,
  PracticeSummary,
  SolutionSummary,
} from "@vitalos/cms";
import type {
  FeatureGridItem,
  IndustryShowcaseItem,
  LabShowcaseItem,
  PracticeShowcaseItem,
  ProcessCycleStage,
  SolutionShowcaseItem,
} from "@vitalos/ui";
import { iconFor } from "./icons";
import { industryArtworkFor } from "./industry-artwork";
import type { MapOptions } from "./patterns";
import { labAssetPresentation, toOfferRows, toRow, toRows, toSolutionCard } from "./patterns";
import { practiceArtworkFor } from "./practice-artwork";
import { solutionDiagramFor } from "./solution-diagrams";
import { stageIconFor } from "./stage-icons";
import type { DerivedStage } from "./stages";

/**
 * Items for the homepage showcases, shared by every page that carries them (pages redesign,
 * 15 Oct 2026): each item gets its locked-name icon and its brand-system artwork or line diagram
 * (ADR-044). Callers order the
 * summaries (orderByLockedNames) first.
 */
export function practiceShowcaseItems(
  practices: readonly PracticeSummary[],
  options: MapOptions = {},
): PracticeShowcaseItem[] {
  return toRows("practice", practices, options).map((row) => {
    return {
      title: row.title,
      href: row.href,
      ...(row.summary ? { summary: row.summary } : {}),
      icon: iconFor("practice", row.title),
      art: practiceArtworkFor(row.title),
    };
  });
}

export function solutionShowcaseItems(
  solutions: readonly SolutionSummary[],
  options: MapOptions = {},
): SolutionShowcaseItem[] {
  return solutions.flatMap((solution) => {
    const card = toSolutionCard(solution, options);
    if (!card) return [];
    const diagram = solutionDiagramFor(card.title);
    return [
      {
        title: card.title,
        href: card.href,
        ...(card.summary ? { summary: card.summary } : {}),
        icon: iconFor("solution", card.title),
        ...(diagram ? { diagram } : {}),
      },
    ];
  });
}

export function industryShowcaseItems(
  industries: readonly IndustrySummary[],
  options: MapOptions = {},
): IndustryShowcaseItem[] {
  return toRows("industry", industries, options).map((row) => {
    return {
      title: row.title,
      href: row.href,
      ...(row.summary ? { summary: row.summary } : {}),
      icon: iconFor("industry", row.title),
      art: industryArtworkFor(row.title),
    };
  });
}

/** Offers as linked icon cards, with the typical duration as the card's fact. */
export function offerFeatureItems(offers: readonly OfferSummary[]): FeatureGridItem[] {
  return toOfferRows(offers).map((row) => {
    const duration = row.meta?.[0]?.value;
    return {
      title: row.title,
      href: row.href,
      ...(row.summary ? { text: row.summary } : {}),
      icon: iconFor("offer", row.title),
      ...(typeof duration === "string" ? { meta: duration } : {}),
    };
  });
}

/**
 * The nine locked stages for the lifecycle ring, each with its line icon and the summary the How We
 * Work page gives it (deriveStages).
 */
export function lifecycleStages(described: readonly DerivedStage[] = []): ProcessCycleStage[] {
  const summaries = new Map(described.map((stage) => [stage.title, stage.summary]));
  return howWeWorkStages.map((stage) => {
    const icon = stageIconFor(stage);
    const summary = summaries.get(stage);
    return {
      title: stage as string,
      ...(summary ? { summary } : {}),
      ...(icon ? { icon } : {}),
    };
  });
}

/** Lab assets for the Labs bench (LabShowcase), each with its type and maturity in words. */
export function labShowcaseItems(
  assets: readonly LabAssetSummary[],
  options: MapOptions = {},
): LabShowcaseItem[] {
  return assets.flatMap((asset) => {
    const { eyebrow, maturity, maturityLabel } = labAssetPresentation(asset);
    const row = toRow("labAsset", asset, { ...options, eyebrow });
    return row ? [{ ...row, maturity, maturityLabel }] : [];
  });
}
