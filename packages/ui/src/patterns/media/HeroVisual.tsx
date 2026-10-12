import { cx } from "../../primitives/_internal/cx";
import { Parallax } from "../../motion/Parallax";
import type { CSSProperties } from "react";
import { hasText } from "../_internal/types";

export interface HeroVisualProps {
  /**
   * Ordered stage names shown on the floating panel, for example the locked signature journey.
   * The panel is omitted without them. Supplied by the caller; nothing is invented here.
   */
  steps?: readonly string[] | undefined;
  className?: string | undefined;
}

/** Timeline (ms after load): card in at 240, steps from 600 every 350, bars once the last step has landed. */
const STEPS_AT = 600;
const STEP_GAP = 350;
const BARS_AT = 2200;

/**
 * The homepage hero composition from the owner comp, rebuilt with tokens only: angled planes in
 * the blue and aqua tints, a thin flow line, and a floating panel that lists a sequence of
 * stages. It replaces the comp's photograph collage (no stock imagery) and its sample metrics
 * (no figures). Entirely decorative: hidden from assistive technology, because the same stages
 * are presented with proper semantics elsewhere on the page. On load (CSS only, so it starts
 * with the first paint and needs no JavaScript) the planes rise in, then the process card fades up
 * and its steps tick in one after another (the last lands in blue with a single pulse ring), the
 * signal bars grow, and then idle in a slow wave; the connector line drifts. Under reduced motion
 * (and if animation fails) all of it renders in its final state. See the hv-* rules in the token
 * CSS (owner decision 2026-10-12).
 */
export function HeroVisual({ steps, className }: HeroVisualProps) {
  const shown = (steps ?? []).filter(hasText);
  return (
    <div
      aria-hidden="true"
      data-visual="hero"
      className={cx("pointer-events-none relative isolate overflow-hidden select-none", className)}
    >
      {/* The one parallax element of the page: the back plane drifts up a few pixels as the page
          scrolls (Parallax island; static without JavaScript and under reduced motion). */}
      <Parallax className="absolute inset-y-[4%] left-[6%] w-[44%]">
        <div className="h-full w-full -skew-x-12 rounded-xl border border-white bg-linear-160 from-blue-100 to-blue-50 motion-safe:animate-[hero-plane_var(--duration-diagram)_var(--ease-emphasis)_both]" />
      </Parallax>
      <div className="absolute top-[18%] bottom-[2%] left-[36%] w-[40%] -skew-x-12 rounded-xl border border-white bg-linear-160 from-aqua-50 to-blue-50 motion-safe:animate-[hero-plane_var(--duration-diagram)_var(--ease-emphasis)_120ms_both]" />
      <div className="absolute inset-y-0 left-[70%] w-[40%] -skew-x-12 bg-linear-to-b from-blue-50 to-transparent" />
      <svg
        className="absolute inset-0 h-full w-full text-blue-600"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          className="hv-flow"
          d="M10 250 C 120 250, 140 120, 230 120 S 330 40, 395 40"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 5"
          vectorEffect="non-scaling-stroke"
          opacity="0.5"
        />
      </svg>
      {shown.length > 0 ? (
        <div className="absolute top-[8%] right-[5%] w-[min(17rem,60%)]">
          <div className="hv-card rounded-lg border border-border bg-white p-(--space-5) shadow-(--shadow-floating)">
            <ol className="m-0 flex list-none flex-col gap-(--space-3) p-0">
              {shown.map((step, index) => {
                const last = index === shown.length - 1;
                const d = `${STEPS_AT + index * STEP_GAP}ms`;
                return (
                  <li
                    key={`${step}-${index}`}
                    className="flex items-center gap-(--space-3) text-small font-medium text-midnight-950"
                  >
                    <span
                      style={{ "--d": d } as CSSProperties}
                      className={cx(
                        "hv-dot relative inline-flex size-5 shrink-0 items-center justify-center rounded-full text-white",
                        last ? "bg-blue-600" : "bg-midnight-950",
                      )}
                    >
                      {last ? (
                        <span
                          style={
                            { "--d": `${STEPS_AT + index * STEP_GAP + 250}ms` } as CSSProperties
                          }
                          className="hv-ring absolute inset-0 rounded-full border-2 border-blue-600 opacity-0"
                        />
                      ) : null}
                      <svg
                        viewBox="0 0 24 24"
                        className="size-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      >
                        <path
                          className="hv-tick"
                          style={{ "--d": d } as CSSProperties}
                          d="m5 12.5 4.5 4.5L19 7.5"
                          pathLength={1}
                          strokeDasharray={1}
                          strokeDashoffset={0}
                        />
                      </svg>
                    </span>
                    <span className="hv-label" style={{ "--d": d } as CSSProperties}>
                      {step}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-(--space-4) flex items-end gap-(--space-1)">
              {[30, 45, 60, 80, 100].map((height, index) => (
                <span
                  key={height}
                  className="hv-bar w-2 rounded-sm bg-blue-600"
                  style={
                    {
                      height: `${height * 0.32}px`,
                      opacity: 0.35 + height / 160,
                      "--d": `${BARS_AT + index * 90}ms`,
                      "--w": `${index * 250}ms`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
