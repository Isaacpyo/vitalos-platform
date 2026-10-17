"use client";

import { useState } from "react";
import * as m from "motion/react-m";
import {
  EASE_EMPHASIS,
  MotionIsland,
  SECONDS,
  useMotionAllowed,
} from "../../motion/_internal/island";
import { cx } from "../../primitives/_internal/cx";
import { Icon, type IconName } from "../../primitives/Icon";
import { IconTile } from "../../primitives/IconTile";
import type { ItemHeadingLevel } from "../_internal/types";
import { LineDiagram, type LineDiagramName } from "../artwork/LineDiagram";

export interface SolutionShowcaseItem {
  title: string;
  href: string;
  summary?: string | undefined;
  icon?: IconName | undefined;
  /**
   * Decorative line diagram (the title is the visible label) beside the text in the panel
   * (ADR-044). Without one the panel shows the icon.
   */
  diagram?: LineDiagramName | undefined;
}

export interface SolutionShowcaseProps {
  items: readonly SolutionShowcaseItem[];
  /** Outline level of each solution title. Defaults to 3. */
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The solutions as a numbered list of titles on the left and, from lg, a dark panel on the right
 * that presents the pointed or focused solution: its number, title and summary beside its line
 * diagram (or its icon, without one) (owner direction, 15 Oct 2026; diagrams ADR-044). The text
 * rises into place on each change (moved only, never clipped or faded: ADR-044 amends ADR-024
 * decision 4); the diagram cross-fades (CSS transitions on classes, so no inline styles and
 * instant under reduced motion); a progress bar marks which solution is active.
 *
 * The list rows are the links; the panel repeats them visually, so it is hidden from assistive
 * technology and holds nothing focusable. Nothing moves on its own. The server HTML (and the page
 * without JavaScript) shows the first solution; under reduced motion the panel simply switches.
 * Below lg there is no panel: each row shows its summary.
 */
export function SolutionShowcase(props: SolutionShowcaseProps) {
  return (
    <MotionIsland>
      <SolutionShowcaseInner {...props} />
    </MotionIsland>
  );
}

function SolutionShowcaseInner({ items, headingLevel = 3, className }: SolutionShowcaseProps) {
  const [active, setActive] = useState(0);
  const motionAllowed = useMotionAllowed();
  const Heading = `h${headingLevel}` as const;
  const current = items[active] ?? items[0];
  if (!current) return null;
  const withDiagrams = items.some((item) => item.diagram);

  return (
    <div
      className={cx(
        "grid gap-x-(--space-8) gap-y-(--space-6) lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-stretch",
        className,
      )}
    >
      <ol className="m-0 grid list-none gap-(--space-3) p-0 lg:gap-0 lg:border-t lg:border-tone-border">
        {items.map((item, index) => {
          const on = index === active;
          return (
            <li key={item.href} className="min-w-0 lg:border-b lg:border-tone-border">
              <a
                href={item.href}
                onPointerEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                data-active={on ? "" : undefined}
                className={cx(
                  "group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-(--space-4) rounded-xl border border-tone-border p-(--space-4) no-underline",
                  "lg:items-center lg:rounded-none lg:border-0 lg:px-(--space-4) lg:py-(--space-5)",
                  "transition-colors duration-(--duration-reveal) ease-(--ease-standard)",
                  on ? "lg:bg-tone-tile-bg/50" : "lg:hover:bg-tone-tile-bg/25",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute inset-y-0 left-0 hidden w-0.5 origin-top bg-tone-action transition-transform duration-(--duration-entrance) ease-(--ease-emphasis) lg:block",
                    on ? "scale-y-100" : "scale-y-0",
                  )}
                />
                <span aria-hidden="true" className="contents">
                  {item.icon ? <IconTile name={item.icon} size="sm" className="lg:hidden" /> : null}
                  <span
                    className={cx(
                      "pt-1 text-small font-semibold tabular-nums transition-colors duration-(--duration-reveal) lg:pt-0",
                      on ? "text-tone-link" : "text-tone-muted",
                      item.icon && "hidden lg:inline",
                    )}
                  >
                    {pad(index + 1)}
                  </span>
                </span>
                <span className="min-w-0">
                  <Heading
                    className={cx(
                      "m-0 text-h3 text-balance transition-colors duration-(--duration-reveal)",
                      on ? "text-tone-heading" : "text-tone-heading lg:text-tone-text",
                    )}
                  >
                    {item.title}
                  </Heading>
                  {item.summary ? (
                    // The panel shows the summary from lg; the compact layout shows it here.
                    <span className="mt-(--space-2) block text-body text-pretty text-tone-muted lg:hidden">
                      {item.summary}
                    </span>
                  ) : null}
                </span>
                <Icon
                  name="arrow-right"
                  size={20}
                  className={cx(
                    "mt-1 transition-[translate,color] duration-(--duration-reveal) ease-(--ease-standard) lg:mt-0",
                    on
                      ? "text-tone-link lg:translate-x-0"
                      : "text-tone-muted lg:-translate-x-1 group-hover:translate-x-0",
                  )}
                />
              </a>
            </li>
          );
        })}
      </ol>

      <div
        aria-hidden="true"
        data-tone="dark"
        data-solution-panel=""
        className={cx(
          "relative isolate hidden min-h-[24rem] overflow-hidden rounded-2xl bg-tone-bg p-(--space-8) text-tone-text",
          withDiagrams
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-x-(--space-6)"
            : "lg:flex lg:flex-col",
        )}
      >
        {/* The 12-column grid as hairlines (brand graphic language; no glow). */}
        <span className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--color-midnight-800)_1px,transparent_1px)] bg-[length:calc(100%/12)_100%]" />
        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <m.div
            key={active}
            initial={motionAllowed ? { y: 20 } : false}
            animate={{ y: 0 }}
            transition={{ duration: SECONDS.entrance + 0.15, ease: EASE_EMPHASIS }}
            className="flex flex-1 flex-col justify-center"
          >
            {current.icon && !current.diagram ? <IconTile name={current.icon} size="lg" /> : null}
            <p
              className={cx(
                "m-0 text-eyebrow text-tone-eyebrow uppercase tabular-nums",
                current.icon && !current.diagram && "mt-(--space-6)",
              )}
            >
              {pad(active + 1)} / {pad(items.length)}
            </p>
            <p
              className={cx(
                "m-0 mt-(--space-2) font-semibold text-balance text-tone-heading",
                withDiagrams ? "text-h3" : "text-h2",
              )}
            >
              {current.title}
            </p>
            {current.summary ? (
              <p className="m-0 mt-(--space-4) max-w-(--container-prose) text-body-l text-pretty text-tone-text">
                {current.summary}
              </p>
            ) : null}
          </m.div>
          <div className="mt-(--space-7) flex gap-(--space-2)">
            {items.map((item, index) => (
              <span
                key={item.href}
                className={cx(
                  "h-1 rounded-full transition-[width,background-color] duration-(--duration-entrance) ease-(--ease-emphasis)",
                  index === active ? "w-10 bg-blue-600" : "w-4 bg-white/25",
                )}
              />
            ))}
          </div>
        </div>
        {withDiagrams ? (
          <div className="relative aspect-square w-full max-w-[22rem] self-center justify-self-center">
            {items.map((item, index) => {
              const on = index === active;
              const look = cx(
                "absolute inset-0 flex size-full items-center justify-center",
                "transition-[opacity,translate] duration-(--duration-diagram) ease-(--ease-emphasis)",
                on ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
              );
              return (
                <span key={item.href} className={look}>
                  {item.diagram ? (
                    <LineDiagram name={item.diagram} className="size-full" />
                  ) : item.icon ? (
                    <IconTile name={item.icon} size="lg" />
                  ) : null}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
