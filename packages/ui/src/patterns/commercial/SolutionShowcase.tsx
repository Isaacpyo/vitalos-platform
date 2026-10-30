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

/** A square illustration on a transparent background; `srcSet` with width descriptors. */
export interface SolutionShowcaseImage {
  src: string;
  srcSet?: string | undefined;
  width: number;
  height: number;
}

export interface SolutionShowcaseItem {
  title: string;
  href: string;
  summary?: string | undefined;
  icon?: IconName | undefined;
  /**
   * Decorative illustration (the title is the visible label): beside the text in the panel, and
   * as a thumbnail in the compact layout. Without one the panel shows the icon.
   */
  image?: SolutionShowcaseImage | undefined;
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
 * that presents the pointed or focused solution: its number, title and summary beside its
 * illustration (or its icon, without one) (owner direction, 15 Oct 2026). The text wipes up into
 * place on each change (moved and clipped, never faded: ADR-024 decision 4); the illustration
 * swaps with a short zoom and turn (CSS transitions on classes, so no inline styles and instant
 * under reduced motion); a progress bar marks which solution is active, and a glow drifts to it.
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
  const share = items.length > 1 ? active / (items.length - 1) : 0;
  const withImages = items.some((item) => item.image);

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
                  {item.image ? (
                    <img
                      src={item.image.src}
                      {...(item.image.srcSet ? { srcSet: item.image.srcSet } : {})}
                      sizes="4rem"
                      width={item.image.width}
                      height={item.image.height}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-16 object-contain lg:hidden"
                    />
                  ) : null}
                  <span
                    className={cx(
                      "pt-1 text-small font-semibold tabular-nums transition-colors duration-(--duration-reveal) lg:pt-0",
                      on ? "text-tone-link" : "text-tone-muted",
                      item.image && "hidden lg:inline",
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
          withImages
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-x-(--space-6)"
            : "lg:flex lg:flex-col",
        )}
      >
        <span className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--color-white)_7%,transparent)_1px,transparent_0)] bg-[length:22px_22px]" />
        <span
          className="absolute -top-28 -z-10 size-96 rounded-full bg-blue-600/25 blur-3xl transition-[left] duration-(--duration-diagram) ease-(--ease-emphasis)"
          style={{ left: `calc(${share * 100}% - 12rem)` }}
        />
        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <m.div
            key={active}
            initial={motionAllowed ? { y: 20, clipPath: "inset(0 0 100% 0)" } : false}
            animate={{ y: 0, clipPath: "inset(0 0 0% 0)" }}
            transition={{ duration: SECONDS.entrance + 0.15, ease: EASE_EMPHASIS }}
            className="flex flex-1 flex-col justify-center"
          >
            {current.icon && !current.image ? <IconTile name={current.icon} size="lg" /> : null}
            <p
              className={cx(
                "m-0 text-eyebrow text-tone-eyebrow uppercase tabular-nums",
                current.icon && !current.image && "mt-(--space-6)",
              )}
            >
              {pad(active + 1)} / {pad(items.length)}
            </p>
            <p
              className={cx(
                "m-0 mt-(--space-2) font-semibold text-balance text-tone-heading",
                withImages ? "text-h3" : "text-h2",
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
        {withImages ? (
          <div className="relative aspect-square w-full self-center">
            {items.map((item, index) => {
              const on = index === active;
              const look = cx(
                "absolute inset-0 size-full object-contain drop-shadow-[0_24px_48px_color-mix(in_srgb,var(--color-blue-600)_35%,transparent)]",
                "transition-[opacity,scale,rotate] duration-(--duration-diagram) ease-(--ease-emphasis)",
                on ? "scale-100 rotate-0 opacity-100" : "scale-90 -rotate-6 opacity-0",
              );
              // Lazy, the first image too: the panel is hidden below lg (an eager image still downloads
              // there, competing with the hero photograph, the LCP element) and below the fold from lg.
              return item.image ? (
                <img
                  key={item.href}
                  src={item.image.src}
                  {...(item.image.srcSet ? { srcSet: item.image.srcSet } : {})}
                  sizes="(min-width: 1024px) 24rem, 50vw"
                  width={item.image.width}
                  height={item.image.height}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={look}
                />
              ) : (
                <span key={item.href} className={cx(look, "flex items-center justify-center")}>
                  {item.icon ? <IconTile name={item.icon} size="lg" /> : null}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
