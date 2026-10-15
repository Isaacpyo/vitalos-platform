import { cx } from "../../primitives/_internal/cx";
import { Parallax } from "../../motion/Parallax";
import { ReplayOnHover } from "../../motion/ReplayOnHover";
import type { CSSProperties } from "react";
import { hasText } from "../_internal/types";

export interface HeroVisualProps {
  /**
   * Ordered stage names shown on the floating panel, for example the locked signature journey.
   * The panel is omitted without them. Supplied by the caller; nothing is invented here.
   */
  steps?: readonly string[] | undefined;
  /**
   * `planes` (default): the light composition with angled tint planes. `glass`: a translucent
   * midnight panel with a step rail and a data stream, for a dark band over a photograph; it idles
   * with small looping movements (see HeroGlass).
   */
  variant?: "planes" | "glass" | undefined;
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
export function HeroVisual({ steps, variant = "planes", className }: HeroVisualProps) {
  const shown = (steps ?? []).filter(hasText);
  if (variant === "glass") return <HeroGlass steps={shown} className={className} />;
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

/** The glass rail's bar heights (px at full size): a rising signal, no figure. */
const GLASS_BARS = [10, 14, 19, 25, 32];

/** The entrance steps a hover replays (not the card fade-in, not the idle loops). */
const REPLAYED = ["hv-dot", "hv-tick", "hv-label", "hv-rail", "hv-bar"];
/** Replay from just before the first step: it starts 150ms after the pointer arrives. */
const REPLAY_FROM_MS = STEPS_AT - 150;

/**
 * The `glass` variant: the same stages on a translucent frosted panel (a white wash over a
 * brightened blur, so it stands out from the dark hero without outweighing the headline while the
 * photograph glows through), for the hero photograph under its black overlay (owner decision
 * 2026-10-15). A rail joins the steps and fills from the
 * top as they tick in; the last step lands in Vitalos Blue. A dashed data stream runs into the
 * panel. After the entrance it idles with small loops: the panel floats a few pixels, the last
 * step pulses, the bars breathe and the stream flows. Hovering the panel replays the steps from
 * the first tick (ReplayOnHover; the panel alone takes pointer events). Those loops sit inside the caller's
 * `[data-motion-scope]`, whose MotionPause switch holds them (WCAG 2.2.2); under reduced motion
 * none of it runs and the panel renders in its final state. Text is never drawn faint: the panel
 * fades in under 1s (motion.nojs.spec.ts) and the labels only slide.
 */
function HeroGlass({
  steps,
  className,
}: {
  steps: readonly string[];
  className?: string | undefined;
}) {
  return (
    <div
      aria-hidden="true"
      data-visual="hero"
      className={cx("pointer-events-none relative isolate select-none", className)}
    >
      <svg
        className="absolute inset-0 hidden h-full w-full text-white lg:block"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          className="hv-stream"
          d="M0 280 C 110 270, 150 170, 230 150 S 330 110, 400 60"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeDasharray="2 6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity="0.45"
        />
      </svg>
      {steps.length > 0 ? (
        // Compact screens: in the flow, full width, aligned with the copy above. From lg: floated
        // on the right, centred vertically.
        <div className="relative w-full lg:absolute lg:top-1/2 lg:right-[2%] lg:w-[min(25rem,100%)] lg:-translate-y-1/2">
          <ReplayOnHover
            names={REPLAYED}
            fromMs={REPLAY_FROM_MS}
            className="hv-float pointer-events-auto"
          >
            <div className="hv-card relative overflow-hidden rounded-3xl border border-white/50 bg-linear-to-br from-white/70 to-white/45 p-(--space-5) text-midnight-950 shadow-[0_24px_64px_rgb(0_0_0/0.35)] backdrop-blur-xl backdrop-brightness-125 backdrop-saturate-150 lg:p-(--space-7)">
              <span className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-aqua-600 via-blue-600 to-blue-700" />
              <ol className="relative m-0 flex list-none flex-col gap-(--space-4) p-0 lg:gap-(--space-5)">
                <span className="absolute top-3 bottom-3 left-[0.6875rem] w-px bg-midnight-950/10 lg:top-4 lg:bottom-4 lg:left-[0.9375rem]">
                  <span className="hv-rail block size-full bg-linear-to-b from-aqua-600 to-blue-600" />
                </span>
                {steps.map((step, index) => {
                  const last = index === steps.length - 1;
                  const d = `${STEPS_AT + index * STEP_GAP}ms`;
                  return (
                    <li
                      key={`${step}-${index}`}
                      className={cx(
                        "relative flex items-center gap-(--space-3) text-small lg:gap-(--space-4) lg:text-body",
                        last ? "font-semibold text-midnight-950" : "font-medium text-midnight-950",
                      )}
                    >
                      <span
                        style={{ "--d": d } as CSSProperties}
                        className={cx(
                          "hv-dot relative inline-flex size-6 shrink-0 items-center justify-center rounded-full text-white lg:size-8",
                          last
                            ? "bg-blue-600 shadow-[0_0_18px_rgb(36_87_255/0.55)] ring-4 ring-blue-600/20"
                            : "bg-aqua-600",
                        )}
                      >
                        {last ? (
                          <span
                            style={
                              { "--d": `${STEPS_AT + index * STEP_GAP + 250}ms` } as CSSProperties
                            }
                            className="hv-pulse absolute inset-0 rounded-full border-2 border-blue-600 opacity-0"
                          />
                        ) : null}
                        <svg
                          viewBox="0 0 24 24"
                          className="size-3.5 lg:size-4"
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
              <div className="mt-(--space-5) flex items-end gap-(--space-1) border-t border-midnight-950/10 pt-(--space-4) lg:mt-(--space-6) lg:pt-(--space-5)">
                {GLASS_BARS.map((height, index) => (
                  <span
                    key={height}
                    className="hv-bar-idle w-2 rounded-sm bg-linear-to-t from-blue-600 to-aqua-600 lg:w-2.5"
                    style={
                      {
                        height: `${height}px`,
                        "--d": `${BARS_AT + index * 90}ms`,
                        "--w": `${index * 220}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            </div>
          </ReplayOnHover>
        </div>
      ) : null}
    </div>
  );
}
