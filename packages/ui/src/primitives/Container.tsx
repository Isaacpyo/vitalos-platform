import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cx } from "./_internal/cx";

export type ContainerSize = "wide" | "content" | "prose";

const sizes: Record<ContainerSize, string> = {
  wide: "max-w-(--container-max)",
  content: "max-w-(--container-content)",
  prose: "max-w-(--container-prose)",
};

export interface ContainerProps extends ComponentPropsWithoutRef<"div"> {
  /** wide: broad compositions; content: text-rich pages (default); prose: reading measure. */
  size?: ContainerSize;
  as?: Extract<ElementType, "div" | "main" | "header" | "footer" | "nav" | "article" | "aside">;
}

/** Centres content, applies the fluid page gutter and caps the width. */
export function Container({ size = "content", as = "div", className, ...props }: ContainerProps) {
  const Tag = as;
  return <Tag className={cx("mx-auto w-full px-(--gutter)", sizes[size], className)} {...props} />;
}
