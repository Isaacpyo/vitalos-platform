import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface ProseProps extends ComponentPropsWithoutRef<"div"> {
  /** Editorial serif for long-form thought leadership (Stage 7 section 15.1; provisional). */
  serif?: boolean;
  as?: "div" | "article";
}

/**
 * Body prose with a 60 to 75 character measure. Styles raw rendered content (paragraphs, headings,
 * lists, quotes, code) so rich text from the CMS needs no per-element classes.
 */
export function Prose({ serif = false, as = "div", className, ...props }: ProseProps) {
  const Tag = as as "div";
  return (
    <Tag
      className={cx(
        "text-body max-w-(--container-prose) text-tone-text",
        serif ? "font-serif" : "font-sans",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_p]:my-(--space-4)",
        "[&_h2]:text-h2 [&_h2]:mt-(--space-7) [&_h2]:mb-(--space-4) [&_h2]:text-tone-heading",
        "[&_h3]:text-h3 [&_h3]:mt-(--space-6) [&_h3]:mb-(--space-3) [&_h3]:text-tone-heading",
        "[&_h4]:text-body-l [&_h4]:mt-(--space-5) [&_h4]:mb-(--space-2) [&_h4]:font-semibold [&_h4]:text-tone-heading",
        "[&_ul]:my-(--space-4) [&_ul]:list-disc [&_ul]:pl-(--space-5)",
        "[&_ol]:my-(--space-4) [&_ol]:list-decimal [&_ol]:pl-(--space-5)",
        "[&_li]:my-(--space-2)",
        "[&_a]:text-tone-link [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-tone-link-hover",
        "[&_strong]:font-semibold",
        "[&_blockquote]:my-(--space-5) [&_blockquote]:border-l-2 [&_blockquote]:border-tone-border [&_blockquote]:pl-(--space-4)",
        "[&_code]:font-mono [&_code]:text-[0.9em]",
        "[&_hr]:my-(--space-6) [&_hr]:border-tone-border",
        className,
      )}
      {...props}
    />
  );
}
