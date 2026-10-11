import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./_internal/cx";

export interface QuoteProps extends Omit<ComponentPropsWithoutRef<"figure">, "children"> {
  /** The quoted words. */
  children: ReactNode;
  /**
   * Who said it (name, role, organisation). REQUIRED: a quote is always attributed
   * (Stage 9 section 16) and renders nothing without it.
   */
  attribution: NonNullable<ReactNode>;
  /** URL of the source of the quotation, if published. */
  cite?: string;
}

/** Attributed quotation: `<figure>` with `<blockquote>` and `<figcaption>`. */
export function Quote({ children, attribution, cite, className, ...props }: QuoteProps) {
  if (
    attribution === null ||
    attribution === undefined ||
    attribution === false ||
    attribution === ""
  ) {
    return null;
  }
  return (
    <figure
      className={cx("m-0 border-l-2 border-tone-border pl-(--space-5)", className)}
      {...props}
    >
      <blockquote {...(cite ? { cite } : {})} className="m-0 text-h3 text-tone-heading">
        {children}
      </blockquote>
      <figcaption className="mt-(--space-4) text-small text-tone-muted">{attribution}</figcaption>
    </figure>
  );
}
