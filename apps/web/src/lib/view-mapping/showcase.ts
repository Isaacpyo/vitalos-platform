import { howWeWorkStages } from "@vitalos/cms";
import type { IndustrySummary, OfferSummary, PracticeSummary, SolutionSummary } from "@vitalos/cms";
import type {
  FeatureGridItem,
  IndustryShowcaseItem,
  PracticeShowcaseItem,
  ProcessCycleStage,
  SolutionShowcaseItem,
} from "@vitalos/ui";
import { iconFor } from "./icons";
import { industryImageFor } from "./industry-images";
import type { MapOptions } from "./patterns";
import { toOfferRows, toRows, toSolutionCard } from "./patterns";
import { practiceImageFor } from "./practice-images";
import { solutionImageFor } from "./solution-images";
import { stageImageFor } from "./stage-images";
import type { DerivedStage } from "./stages";

/**
 * Items for the homepage showcases, shared by every page that carries them (pages redesign,
 * 15 Oct 2026): each item gets its locked-name icon and approved image. Callers order the
 * summaries (orderByLockedNames) first.
 */
export function practiceShowcaseItems(
  practices: readonly PracticeSummary[],
  options: MapOptions = {},
): PracticeShowcaseItem[] {
  return toRows("practice", practices, options).map((row) => {
    const image = practiceImageFor(row.title);
    return {
      title: row.title,
      href: row.href,
      ...(row.summary ? { summary: row.summary } : {}),
      icon: iconFor("practice", row.title),
      ...(image ? { image } : {}),
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
    const image = solutionImageFor(card.title);
    return [
      {
        title: card.title,
        href: card.href,
        ...(card.summary ? { summary: card.summary } : {}),
        icon: iconFor("solution", card.title),
        ...(image ? { image } : {}),
      },
    ];
  });
}

export function industryShowcaseItems(
  industries: readonly IndustrySummary[],
  options: MapOptions = {},
): IndustryShowcaseItem[] {
  return toRows("industry", industries, options).map((row) => {
    const image = industryImageFor(row.title);
    return {
      title: row.title,
      href: row.href,
      ...(row.summary ? { summary: row.summary } : {}),
      icon: iconFor("industry", row.title),
      ...(image ? { image } : {}),
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
 * The nine locked stages for the lifecycle ring, each with its disc and the summary the How We
 * Work page gives it (deriveStages).
 */
export function lifecycleStages(described: readonly DerivedStage[] = []): ProcessCycleStage[] {
  const summaries = new Map(described.map((stage) => [stage.title, stage.summary]));
  return howWeWorkStages.map((stage) => {
    const image = stageImageFor(stage);
    const summary = summaries.get(stage);
    return {
      title: stage as string,
      ...(summary ? { summary } : {}),
      ...(image ? { image } : {}),
    };
  });
}
