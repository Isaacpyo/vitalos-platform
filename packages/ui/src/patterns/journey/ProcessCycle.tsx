"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import * as m from "motion/react-m";
import {
  EASE_EMPHASIS,
  MotionIsland,
  SECONDS,
  prefersReducedMotion,
  useMotionAllowed,
} from "../../motion/_internal/island";
import { cx } from "../../primitives/_internal/cx";
import { Icon, type IconName } from "../../primitives/Icon";

export interface ProcessCycleStage {
  title: string;
  /** Shown in the centre of the ring while the stage is active. */
  summary?: string | undefined;
  /** The stage's line icon (decorative; the title is the label). ADR-044. */
  icon?: IconName | undefined;
}

export interface ProcessCycleProps {
  /** The stages in order, clockwise from the top. */
  stages: readonly ProcessCycleStage[];
  /** Accessible name of the list of stages. */
  label: string;
  className?: string | undefined;
}

/** Ring and label geometry, in percent of the square. */
const RING = 37;
const NODE = 15;

/**
 * A delivery lifecycle as a ring of stages (owner direction, 15 Oct 2026), for a dark band.
 * Each stage is a disc on the ring carrying its line icon (the site's icon set, ADR-044), with its
 * name under it (no numbers; the order reads clockwise
 * from the top). The discs are buttons that select a stage (pointer, focus or click), not links
 * (owner direction, 15 Oct 2026); each carries its summary as its description for assistive
 * technology. Pointing at or focusing a stage makes it active: its disc lifts and fills with cobalt, the arc
 * fills from the first stage round to it, and the centre presents its name and summary
 * (the centre repeats the buttons' names and descriptions visually, so it is hidden from
 * assistive technology).
 *
 * The first time the ring scrolls into view the arc draws itself and the stages pop in one
 * after another. That entrance is armed only after hydration, only when motion is allowed and
 * only if the ring is not already on screen, so the server HTML (and the page without
 * JavaScript, and under reduced motion) is the finished ring. Nothing moves on its own after
 * that; every change follows the visitor's pointer or focus.
 */
export function ProcessCycle(props: ProcessCycleProps) {
  return (
    <MotionIsland>
      <ProcessCycleInner {...props} />
    </MotionIsland>
  );
}

function ProcessCycleInner({ stages, label, className }: ProcessCycleProps) {
  const id = useId();
  const [active, setActive] = useState(0);
  const [entrance, setEntrance] = useState<"static" | "armed" | "shown">("static");
  const motionAllowed = useMotionAllowed();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !motionAllowed || prefersReducedMotion()) return;
    if (typeof IntersectionObserver !== "function") return;
    const box = root.getBoundingClientRect();
    // Already on screen: keep the finished ring rather than replay it under the visitor's eyes.
    if (box.top < window.innerHeight && box.bottom > 0) return;
    setEntrance("armed");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEntrance("shown");
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [motionAllowed]);

  const count = stages.length;
  const current = stages[active] ?? stages[0];
  if (!current || count === 0) return null;

  const held = entrance === "armed";
  // The progress arc runs from the first stage to the active one (pathLength 100).
  const progress = count > 1 ? (active / count) * 100 : 0;

  return (
    <div
      ref={rootRef}
      data-cycle={entrance}
      className={cx("relative mx-auto aspect-square w-full max-w-[36rem]", className)}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r={RING}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.35"
          strokeDasharray="0.8 1.6"
          className="text-white/25"
        />
        <circle
          cx="50"
          cy="50"
          r={RING}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${held ? 0 : Math.max(progress, 0.01)} 100`}
          className="text-blue-600 transition-[stroke-dasharray] duration-(--duration-diagram) ease-(--ease-emphasis)"
        />
      </svg>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[27%] flex items-center justify-center text-center"
      >
        <m.div
          key={active}
          initial={motionAllowed ? { y: 14 } : false}
          animate={{ y: 0 }}
          transition={{ duration: SECONDS.entrance + 0.1, ease: EASE_EMPHASIS }}
          className="min-w-0"
        >
          <p className="m-0 text-h3 font-semibold text-tone-heading">{current.title}</p>
          {current.summary ? (
            <p className="m-0 mt-(--space-3) hidden text-small text-pretty text-tone-text sm:line-clamp-4">
              {current.summary}
            </p>
          ) : null}
        </m.div>
      </div>

      <ol aria-label={label} className="m-0 list-none p-0">
        {stages.map((stage, index) => {
          const on = index === active;
          const angle = (-90 + (index * 360) / count) * (Math.PI / 180);
          const position: CSSProperties = {
            left: `${50 + RING * Math.cos(angle)}%`,
            top: `${50 + RING * Math.sin(angle)}%`,
            width: `${NODE}%`,
            transitionDelay: entrance === "shown" ? `${index * 70}ms` : undefined,
          };
          return (
            <li
              key={`${stage.title}-${index}`}
              style={position}
              className={cx(
                "absolute aspect-square -translate-x-1/2 -translate-y-1/2",
                "transition-[scale] duration-(--duration-diagram) ease-(--ease-emphasis)",
                held ? "scale-0" : "scale-100",
              )}
            >
              <button
                type="button"
                onPointerEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
                aria-pressed={on}
                {...(stage.summary ? { "aria-describedby": `${id}-${index}` } : {})}
                data-active={on ? "" : undefined}
                className="group block size-full cursor-pointer rounded-full"
              >
                <span
                  className={cx(
                    "flex size-full items-center justify-center rounded-full border",
                    "transition-[scale,background-color,border-color,color] duration-(--duration-reveal) ease-(--ease-emphasis)",
                    on
                      ? "scale-110 border-blue-600 bg-blue-600 text-white"
                      : "border-slate-700 bg-midnight-800 text-tone-heading group-hover:scale-105 group-hover:border-blue-600",
                  )}
                >
                  {stage.icon ? (
                    <Icon name={stage.icon} size={32} className="size-[45%]" />
                  ) : null}
                </span>
                <span
                  className={cx(
                    "absolute top-full left-1/2 mt-(--space-2) -translate-x-1/2 text-center text-small font-semibold whitespace-nowrap transition-colors duration-(--duration-reveal)",
                    on ? "text-tone-heading" : "text-tone-muted",
                  )}
                >
                  {stage.title}
                </span>
              </button>
              {/* Outside the button, so it describes it without becoming part of its name. */}
              {stage.summary ? (
                <span id={`${id}-${index}`} className="sr-only">
                  {stage.summary}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
