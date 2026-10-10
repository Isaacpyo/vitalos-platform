import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

/** Gap keys are the space tokens (Stage 9 section 7): 1 = 4px ... 10 = 128px. */
export type StackGap = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const gaps: Record<StackGap, string> = {
  1: "gap-(--space-1)",
  2: "gap-(--space-2)",
  3: "gap-(--space-3)",
  4: "gap-(--space-4)",
  5: "gap-(--space-5)",
  6: "gap-(--space-6)",
  7: "gap-(--space-7)",
  8: "gap-(--space-8)",
  9: "gap-(--space-9)",
  10: "gap-(--space-10)",
};

export interface StackProps extends ComponentPropsWithoutRef<"div"> {
  gap?: StackGap;
  direction?: "column" | "row";
  /** Allow children to wrap (row direction). */
  wrap?: boolean;
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  as?: "div" | "ul" | "ol" | "li";
}

const aligns = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

/** One-dimensional layout with a token gap. Use as="ul" or "ol" for real lists. */
export function Stack({
  gap = 4,
  direction = "column",
  wrap = false,
  align,
  as = "div",
  className,
  ...props
}: StackProps) {
  const Tag = as as "div";
  return (
    <Tag
      className={cx(
        "flex",
        direction === "column" ? "flex-col" : "flex-row",
        wrap && "flex-wrap",
        align && aligns[align],
        gaps[gap],
        (as === "ul" || as === "ol") && "list-none p-0",
        className,
      )}
      {...props}
    />
  );
}
