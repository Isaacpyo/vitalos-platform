"use client";

import { useState, type PointerEvent } from "react";
import { useMotionValue, useSpring, useTransform } from "motion/react";
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

/** A pre-sized illustration: `srcSet` with width descriptors, intrinsic size for the ratio. */
export interface PracticeShowcaseImage {
  src: string;
  srcSet?: string | undefined;
  width: number;
  height: number;
}

export interface PracticeShowcaseItem {
  title: string;
  href: string;
  summary?: string | undefined;
  icon?: IconName | undefined;
  /**
   * Decorative illustration of the practice (its title is the visible label). Without one the
   * stage shows the practice's icon on a tint, and the compact layout shows no picture.
   */
  image?: PracticeShowcaseImage | undefined;
}

export interface PracticeShowcaseProps {
  items: readonly PracticeShowcaseItem[];
  /** Outline level of each practice title. Defaults to 3. */
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The stage tilts at most this far (degrees) towards the pointer. */
const TILT = 4;

/**
 * The practices as a numbered list beside a large illustration stage (owner direction, 15 Oct
 * 2026). Pointing at or focusing a practice makes it active: a bar grows beside it, its summary
 * eases open (the others close, from lg), and its illustration cross-fades in with a short zoom and a blur that clears, under a glass label with
 * the practice and its number. The stage leans a few degrees towards the pointer.
 *
 * Nothing moves on its own: every change follows the visitor's pointer or focus, so no pause
 * control is needed (WCAG 2.2.2). The server HTML (and the page without JavaScript) shows the
 * first practice active with its illustration; under reduced motion the stage does not tilt and
 * the illustrations only cross-fade. Below lg there is no stage: each practice shows its own
 * illustration under its text. Text is never faded (ADR-024 decision 4); the label wipes in.
 * Illustrations are decorative (`alt=""`): the titles are the links' names.
 */
export function PracticeShowcase(props: PracticeShowcaseProps) {
  return (
    <MotionIsland>
      <PracticeShowcaseInner {...props} />
    </MotionIsland>
  );
}

function PracticeShowcaseInner({ items, headingLevel = 3, className }: PracticeShowcaseProps) {
  const [active, setActive] = useState(0);
  const motionAllowed = useMotionAllowed();
  const Heading = `h${headingLevel}` as const;

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const spring = { stiffness: 140, damping: 18, mass: 0.6 };
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-TILT, TILT]), spring);
  const rotateX = useSpring(
    useTransform(pointerY, [-0.5, 0.5], [TILT * 0.75, -TILT * 0.75]),
    spring,
  );

  const onStageMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!motionAllowed || event.pointerType === "touch") return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - box.left) / box.width - 0.5);
    pointerY.set((event.clientY - box.top) / box.height - 0.5);
  };
  const onStageLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const current = items[active] ?? items[0];
  if (!current) return null;

  return (
    <div
      className={cx(
        "grid gap-x-(--space-8) gap-y-(--space-6) lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center",
        className,
      )}
    >
      <ol className="m-0 grid list-none gap-(--space-3) p-0 lg:gap-(--space-1)">
        {items.map((item, index) => {
          const on = index === active;
          return (
            <li key={item.href} className="min-w-0">
              <a
                href={item.href}
                onPointerEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                data-active={on ? "" : undefined}
                className={cx(
                  "group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-(--space-4) rounded-xl border border-tone-border p-(--space-4) no-underline lg:border-transparent",
                  "transition-colors duration-(--duration-reveal) ease-(--ease-standard)",
                  on ? "lg:bg-tone-tile-bg/50" : "lg:hover:bg-tone-tile-bg/25",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute inset-y-(--space-3) left-0 hidden w-0.5 origin-top rounded-full bg-tone-action transition-transform duration-(--duration-entrance) ease-(--ease-emphasis) lg:block",
                    on ? "scale-y-100" : "scale-y-0",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cx(
                    "pt-1 text-small font-semibold tabular-nums transition-colors duration-(--duration-reveal)",
                    on ? "text-tone-link" : "text-tone-muted",
                  )}
                >
                  {pad(index + 1)}
                </span>
                <span className="min-w-0">
                  <Heading className="m-0 text-h3 text-balance text-tone-heading">
                    {item.title}
                  </Heading>
                  {item.summary ? (
                    // From lg only the active practice opens its summary: the row's height eases
                    // open (grid rows 0fr to 1fr, CSS only; instant under reduced motion).
                    <span
                      className={cx(
                        "grid transition-[grid-template-rows] duration-(--duration-entrance) ease-(--ease-emphasis)",
                        on ? "grid-rows-[1fr]" : "grid-rows-[1fr] lg:grid-rows-[0fr]",
                      )}
                    >
                      <span className="min-h-0 overflow-hidden">
                        <span className="block pt-(--space-2) text-body text-pretty text-tone-muted">
                          {item.summary}
                        </span>
                      </span>
                    </span>
                  ) : null}
                </span>
                <Icon
                  name="arrow-right"
                  size={20}
                  className={cx(
                    "mt-1 transition-[translate,color] duration-(--duration-reveal) ease-(--ease-standard)",
                    on
                      ? "text-tone-link lg:translate-x-0"
                      : "text-tone-muted lg:-translate-x-1 group-hover:translate-x-0",
                  )}
                />
                {item.image ? (
                  <span className="col-span-3 mt-(--space-4) block overflow-hidden rounded-lg border border-tone-border lg:hidden">
                    <img
                      src={item.image.src}
                      {...(item.image.srcSet ? { srcSet: item.image.srcSet } : {})}
                      sizes="100vw"
                      width={item.image.width}
                      height={item.image.height}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="block aspect-video h-auto w-full object-cover"
                    />
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ol>

      <div
        aria-hidden="true"
        data-practice-stage=""
        className="hidden [perspective:1400px] lg:block"
      >
        <m.div
          onPointerMove={onStageMove}
          onPointerLeave={onStageLeave}
          {...(motionAllowed ? { style: { rotateX, rotateY } } : {})}
          className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-tone-border bg-cloud-50 shadow-floating [transform-style:preserve-3d]"
        >
          {items.map((item, index) => {
            const on = index === active;
            // CSS transitions on classes, not Motion: no inline styles in the server HTML, and
            // the global reduced-motion rule makes the change instant.
            const look = cx(
              "absolute inset-0 transition-[opacity,scale,filter] duration-(--duration-diagram) ease-(--ease-emphasis)",
              on ? "scale-100 opacity-100 blur-none" : "scale-[1.06] opacity-0 blur-sm",
            );
            if (!item.image) {
              return (
                <div
                  key={item.href}
                  className={cx(
                    look,
                    "flex items-center justify-center bg-linear-160 from-blue-50 to-aqua-50",
                  )}
                >
                  {item.icon ? <IconTile name={item.icon} size="lg" /> : null}
                </div>
              );
            }
            return (
              <img
                key={item.href}
                src={item.image.src}
                {...(item.image.srcSet ? { srcSet: item.image.srcSet } : {})}
                sizes="(min-width: 1024px) 56vw, 100vw"
                width={item.image.width}
                height={item.image.height}
                alt=""
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                className={cx(look, "size-full object-cover")}
              />
            );
          })}
          <m.div
            key={active}
            initial={motionAllowed ? { y: 16 } : false}
            animate={{ y: 0 }}
            transition={{ duration: SECONDS.entrance + 0.1, ease: EASE_EMPHASIS, delay: 0.08 }}
            className="absolute bottom-(--space-5) left-(--space-5) flex items-center gap-(--space-3) rounded-xl border border-white/70 bg-white/80 py-(--space-3) pr-(--space-5) pl-(--space-3) shadow-(--shadow-floating) backdrop-blur-md"
          >
            {current.icon ? <IconTile name={current.icon} size="sm" /> : null}
            <span className="min-w-0">
              <span className="block text-eyebrow text-tone-muted tabular-nums">
                {pad(active + 1)} / {pad(items.length)}
              </span>
              <span className="block text-body font-semibold text-tone-heading">
                {current.title}
              </span>
            </span>
          </m.div>
        </m.div>
      </div>
    </div>
  );
}
