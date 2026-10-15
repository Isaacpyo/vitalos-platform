"use client";

import { useState, type PointerEvent } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Icon, type IconName } from "../../primitives/Icon";
import { IconTile } from "../../primitives/IconTile";
import type { ItemHeadingLevel } from "../_internal/types";

/** A photograph for a panel's background; `srcSet` with width descriptors. */
export interface IndustryShowcaseImage {
  src: string;
  srcSet?: string | undefined;
  width: number;
  height: number;
}

export interface IndustryShowcaseItem {
  title: string;
  href: string;
  summary?: string | undefined;
  icon?: IconName | undefined;
  /** Decorative background photograph (the title is the visible label). */
  image?: IndustryShowcaseImage | undefined;
}

export interface IndustryShowcaseProps {
  items: readonly IndustryShowcaseItem[];
  /** Outline level of each industry title. Defaults to 3. */
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

/**
 * The industries as expanding glass panels for a dark band (owner direction, 15 Oct 2026). From
 * lg the panels sit side by side; pointing at or focusing one widens it and opens its summary
 * while the others narrow to their icon and title, and a soft light follows the pointer across
 * the panel. A panel with a photograph shows it behind a midnight gradient that keeps the text
 * legible: brighter and settling from a slight zoom when open, dimmer when narrow. Below lg they
 * stack, every summary open.
 *
 * Plain CSS transitions on classes (flex-grow, grid rows): no inline transforms, instant under
 * reduced motion, and the server HTML (and the page without JavaScript) shows the first panel
 * open. Each panel is a link to the industry; nothing moves on its own.
 */
export function IndustryShowcase({ items, headingLevel = 3, className }: IndustryShowcaseProps) {
  const [active, setActive] = useState(0);
  const Heading = `h${headingLevel}` as const;
  if (items.length === 0) return null;

  // The light follows the pointer through two custom properties (no inline transforms).
  const onMove = (event: PointerEvent<HTMLAnchorElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
  };

  return (
    <ul
      className={cx(
        "m-0 flex list-none flex-col gap-(--space-3) p-0 lg:h-[26rem] lg:flex-row",
        className,
      )}
    >
      {items.map((item, index) => {
        const on = index === active;
        return (
          <li
            key={item.href}
            className={cx(
              "min-w-0 transition-[flex-grow] duration-(--duration-diagram) ease-(--ease-emphasis) lg:basis-0",
              on ? "lg:grow-[2.6]" : "lg:grow",
            )}
          >
            <a
              href={item.href}
              onPointerEnter={() => setActive(index)}
              onPointerMove={onMove}
              onFocus={() => setActive(index)}
              data-active={on ? "" : undefined}
              className={cx(
                "group relative isolate flex h-full min-h-[22rem] flex-col overflow-hidden rounded-2xl border p-(--space-6) no-underline backdrop-blur-sm lg:min-h-0",
                "transition-[border-color,background-color] duration-(--duration-reveal) ease-(--ease-standard)",
                on ? "border-white/25 bg-white/[0.08]" : "border-white/10 bg-white/[0.03]",
              )}
            >
              {item.image ? (
                <>
                  <img
                    src={item.image.src}
                    {...(item.image.srcSet ? { srcSet: item.image.srcSet } : {})}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    width={item.image.width}
                    height={item.image.height}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={cx(
                      "absolute inset-0 -z-20 size-full object-cover",
                      "transition-[scale] duration-[1200ms] ease-(--ease-emphasis)",
                      on ? "scale-100" : "scale-110 group-hover:scale-105",
                    )}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--color-midnight-950)_55%,transparent),color-mix(in_srgb,var(--color-midnight-950)_20%,transparent)_35%,color-mix(in_srgb,var(--color-midnight-950)_85%,transparent)_72%,color-mix(in_srgb,var(--color-midnight-950)_96%,transparent))]"
                  />
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute inset-0 -z-10 bg-midnight-950 transition-opacity duration-(--duration-diagram) ease-(--ease-standard)",
                      on ? "opacity-0" : "opacity-55 group-hover:opacity-30",
                    )}
                  />
                </>
              ) : null}
              <span
                aria-hidden="true"
                className={cx(
                  "absolute inset-0 -z-10 bg-[radial-gradient(22rem_circle_at_var(--spot-x,30%)_var(--spot-y,20%),color-mix(in_srgb,var(--color-blue-600)_35%,transparent),transparent_65%)]",
                  "transition-opacity duration-(--duration-reveal)",
                  on ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              />
              <span
                aria-hidden="true"
                className={cx(
                  "absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/70 to-transparent transition-opacity duration-(--duration-reveal)",
                  on ? "opacity-100" : "opacity-0",
                )}
              />
              {item.icon ? <IconTile name={item.icon} size="lg" /> : null}
              <span className="mt-(--space-6) block min-w-0 lg:mt-auto">
                <Heading className="m-0 text-h3 text-balance text-tone-heading">
                  {item.title}
                </Heading>
                {item.summary ? (
                  // From lg only the open panel shows its summary; the row eases open (0fr to 1fr).
                  <span
                    className={cx(
                      "grid transition-[grid-template-rows] duration-(--duration-diagram) ease-(--ease-emphasis)",
                      on ? "grid-rows-[1fr]" : "grid-rows-[1fr] lg:grid-rows-[0fr]",
                    )}
                  >
                    <span className="min-h-0 overflow-hidden">
                      <span className="block max-w-(--container-prose) pt-(--space-3) text-body text-pretty text-tone-text">
                        {item.summary}
                      </span>
                    </span>
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className={cx(
                  "mt-(--space-5) inline-flex size-11 items-center justify-center self-start rounded-full border",
                  "transition-[background-color,border-color,color,translate] duration-(--duration-reveal) ease-(--ease-standard)",
                  on
                    ? "border-transparent bg-tone-action text-tone-action-text"
                    : "border-white/20 text-tone-heading group-hover:translate-x-1",
                )}
              >
                <Icon name="arrow-right" size={20} />
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
