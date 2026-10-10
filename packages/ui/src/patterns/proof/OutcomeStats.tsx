import { cx } from "../../primitives/_internal/cx";
import { Stat } from "../../primitives/Stat";
import { hasText, isNonEmpty, type NonEmptyArray } from "../_internal/types";

/** Matches OutcomeMetricView. `source` is mandatory (the Stat primitive enforces it too). */
export interface OutcomeStatItem {
  /** The figure exactly as in the evidence, for example "38%". */
  value: string;
  /** What changed, precisely: "reduction in manual processing time", not "better". */
  descriptor: string;
  /** Where the figure comes from. An unsourced figure is dropped, not rendered. */
  source: string;
  context?: string | undefined;
  timeframe?: string | undefined;
  /** When present, only `verified` evidence is shown. */
  evidence?: { status: "verified" | "pending" | "n/a" } | undefined;
}

export interface OutcomeStatsProps {
  /**
   * Sourced outcome figures. The type requires at least one; items without a source or with
   * unverified evidence are dropped, and the module renders nothing if none remain. At most four
   * are shown (Stage 9 section 17: 2 to 4 evidence points).
   */
  stats: NonEmptyArray<OutcomeStatItem>;
  /** Accessible name of the list. */
  "aria-label"?: string | undefined;
  className?: string | undefined;
}

const MAX_STATS = 4;

/** The renderable subset of the supplied stats. Exported for CaseStudyFeature. */
export function renderableStats(
  stats: readonly OutcomeStatItem[] | undefined,
  max = MAX_STATS,
): OutcomeStatItem[] {
  if (!stats) return [];
  return stats
    .filter(
      (stat) =>
        hasText(stat.value) &&
        hasText(stat.descriptor) &&
        hasText(stat.source) &&
        (stat.evidence === undefined || stat.evidence.status === "verified"),
    )
    .slice(0, max);
}

const columns: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

/** A short group of sourced outcome statistics. */
export function OutcomeStats({ stats, "aria-label": ariaLabel, className }: OutcomeStatsProps) {
  if (!isNonEmpty(stats)) return null;
  return <OutcomeStatList stats={stats} aria-label={ariaLabel} className={className} />;
}

/**
 * Renders any list of stats (possibly empty) through the same filtering. Used by the case-study
 * patterns, which show a bounded number of optional metrics. Not part of the public surface.
 */
export function OutcomeStatList({
  stats,
  max = MAX_STATS,
  "aria-label": ariaLabel,
  className,
}: {
  stats: readonly OutcomeStatItem[] | undefined;
  max?: number;
  "aria-label"?: string | undefined;
  className?: string | undefined;
}) {
  const shown = renderableStats(stats, max);
  if (shown.length === 0) return null;
  return (
    <ul
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      className={cx(
        "m-0 grid list-none gap-x-(--space-6) gap-y-(--space-6) p-0",
        columns[shown.length] ?? columns[4],
        className,
      )}
    >
      {shown.map((stat, index) => (
        <li key={`${stat.value}-${index}`} className="min-w-0">
          <Stat
            value={stat.value}
            descriptor={stat.descriptor}
            source={stat.source}
            context={[stat.context, stat.timeframe].filter(hasText).join(" · ") || undefined}
          />
        </li>
      ))}
    </ul>
  );
}
