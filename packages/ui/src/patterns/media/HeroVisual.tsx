import { cx } from "../../primitives/_internal/cx";
import { Icon } from "../../primitives/Icon";
import { hasText } from "../_internal/types";

export interface HeroVisualProps {
  /**
   * Ordered stage names shown on the floating panel, for example the locked signature journey.
   * The panel is omitted without them. Supplied by the caller; nothing is invented here.
   */
  steps?: readonly string[] | undefined;
  className?: string | undefined;
}

/**
 * The homepage hero composition from the owner comp, rebuilt with tokens only: angled planes in
 * the blue and aqua tints, a thin flow line, and a floating panel that lists a sequence of
 * stages. It replaces the comp's photograph collage (no stock imagery) and its sample metrics
 * (no figures). Entirely decorative: hidden from assistive technology, because the same stages
 * are presented with proper semantics elsewhere on the page. The planes drift in once on load
 * and hold still under reduced motion.
 */
export function HeroVisual({ steps, className }: HeroVisualProps) {
  const shown = (steps ?? []).filter(hasText);
  return (
    <div
      aria-hidden="true"
      data-visual="hero"
      className={cx("pointer-events-none relative isolate overflow-hidden select-none", className)}
    >
      <div className="absolute inset-y-[4%] left-[6%] w-[44%] -skew-x-12 rounded-xl border border-white bg-linear-160 from-blue-100 to-blue-50 motion-safe:animate-[hero-plane_var(--duration-diagram)_var(--ease-emphasis)_both]" />
      <div className="absolute top-[18%] bottom-[2%] left-[36%] w-[40%] -skew-x-12 rounded-xl border border-white bg-linear-160 from-aqua-50 to-blue-50 motion-safe:animate-[hero-plane_var(--duration-diagram)_var(--ease-emphasis)_120ms_both]" />
      <div className="absolute inset-y-0 left-[70%] w-[40%] -skew-x-12 bg-linear-to-b from-blue-50 to-transparent" />
      <svg
        className="absolute inset-0 h-full w-full text-blue-600"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M10 250 C 120 250, 140 120, 230 120 S 330 40, 395 40"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 5"
          vectorEffect="non-scaling-stroke"
          opacity="0.5"
        />
      </svg>
      {shown.length > 0 ? (
        <div className="absolute top-[8%] right-[5%] w-[min(17rem,60%)] rounded-lg border border-border bg-white p-(--space-5) shadow-(--shadow-floating) motion-safe:animate-[hero-panel_var(--duration-diagram)_var(--ease-emphasis)_240ms_both]">
          <ol className="m-0 flex list-none flex-col gap-(--space-3) p-0">
            {shown.map((step, index) => (
              <li
                key={`${step}-${index}`}
                className="flex items-center gap-(--space-3) text-small font-medium text-midnight-950"
              >
                <span
                  className={cx(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                    index === shown.length - 1
                      ? "bg-blue-600 text-white"
                      : "bg-midnight-950 text-white",
                  )}
                >
                  <Icon name="check" size={16} className="size-3" />
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-(--space-4) flex items-end gap-(--space-1)">
            {[30, 45, 60, 80, 100].map((height) => (
              <span
                key={height}
                className="w-2 rounded-sm bg-blue-600"
                style={{ height: `${height * 0.32}px`, opacity: 0.35 + height / 160 }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
