import { RevealItem } from "../../motion/Reveal";
import { cx } from "../../primitives/_internal/cx";
import { Icon, type IconName } from "../../primitives/Icon";
import { IconTile } from "../../primitives/IconTile";
import { hasText, type ItemHeadingLevel } from "../_internal/types";

export interface FeatureGridItem {
  /** A short title (five words or fewer). Without one, the line is the item. */
  title?: string | undefined;
  /** One line (fifteen words or fewer). */
  text?: string | undefined;
  icon?: IconName | undefined;
  /** Makes the whole card a link to this address. */
  href?: string | undefined;
}

export interface FeatureGridProps {
  items: readonly FeatureGridItem[];
  /** Columns from lg (2 on md, 1 on compact screens). Defaults to 3. */
  columns?: 2 | 3 | 4 | undefined;
  /**
   * `cards`: the homepage showcase cards (rounded, hairline, icon tile, lift on hover when a
   * link). `rows`: hairline rows with an icon tile, for longer lists of statements.
   */
  variant?: "cards" | "rows" | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

const columnClasses = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
} as const;

/**
 * Items as a grid of short cards or rows (owner direction, 15 Oct 2026: inner pages read like the
 * homepage, with icons where the homepage uses them). Each item is an icon tile, a short title and
 * one line; a linked card lifts and turns its border blue on hover or focus, like the Labs bench.
 * Items join the surrounding Band's entrance sequence (RevealItem); outside a Band they never move.
 * Every word comes from props. Icons are decorative: the title or line always carries the meaning.
 */
export function FeatureGrid({
  items,
  columns = 3,
  variant = "cards",
  headingLevel = 3,
  className,
}: FeatureGridProps) {
  const shown = items.filter((item) => hasText(item.title) || hasText(item.text));
  if (shown.length === 0) return null;
  const Heading = `h${headingLevel}` as const;
  const rows = variant === "rows";
  return (
    <ul
      className={cx(
        "m-0 grid list-none grid-cols-1 p-0",
        rows ? "gap-x-(--space-7)" : "gap-(--space-4)",
        shown.length > 1 && (rows ? "md:grid-cols-2" : columnClasses[columns]),
        className,
      )}
    >
      {shown.map((item, index) => {
        const body = (
          <>
            {item.icon ? (
              <IconTile name={item.icon} size={rows ? "sm" : "md"} />
            ) : rows ? (
              <span
                aria-hidden="true"
                className="mt-(--space-1) inline-flex size-7 shrink-0 items-center justify-center self-start rounded-full bg-tone-tile-bg text-tone-tile-fg"
              >
                <Icon name="check" size={16} />
              </span>
            ) : null}
            <span className="block min-w-0">
              {hasText(item.title) ? (
                <Heading
                  className={cx(
                    "m-0 text-balance text-tone-heading",
                    rows ? "text-body-l font-semibold" : "text-h3",
                  )}
                >
                  {item.title}
                </Heading>
              ) : null}
              {hasText(item.text) ? (
                <span
                  className={cx(
                    "block text-pretty text-tone-text",
                    hasText(item.title) ? "mt-(--space-2) text-body" : "text-body-l",
                  )}
                >
                  {item.text}
                </span>
              ) : null}
            </span>
            {item.href ? (
              <span
                aria-hidden="true"
                className="mt-auto inline-flex size-10 shrink-0 items-center justify-center self-start rounded-full border border-tone-border text-tone-link transition-[translate,border-color,background-color,color] duration-(--duration-reveal) ease-(--ease-standard) group-hover:translate-x-1 group-hover:border-transparent group-hover:bg-tone-action group-hover:text-tone-action-text"
              >
                <Icon name="arrow-right" size={16} />
              </span>
            ) : null}
          </>
        );
        const itemClass = rows
          ? "flex min-w-0 items-start gap-(--space-4) border-t border-tone-border py-(--space-5)"
          : cx(
              "group relative flex h-full min-w-0 flex-col gap-(--space-5) rounded-2xl border border-tone-border bg-tone-bg p-(--space-6) no-underline",
              item.href &&
                "transition-[translate,border-color,box-shadow] duration-(--duration-reveal) ease-(--ease-standard) hover:-translate-y-1 hover:border-blue-600/60 hover:shadow-floating focus-visible:border-blue-600/60",
            );
        return (
          <RevealItem as="li" key={`${item.title ?? item.text}-${index}`} className="min-w-0">
            {item.href ? (
              <a href={item.href} className={itemClass}>
                {body}
              </a>
            ) : (
              <div className={itemClass}>{body}</div>
            )}
          </RevealItem>
        );
      })}
    </ul>
  );
}
