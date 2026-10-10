import type { AnchorHTMLAttributes } from "react";
import { cx } from "./_internal/cx";
import { SlideArrow } from "./SlideArrow";

export interface TextLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /**
   * Directional arrow after the label (standalone editorial navigation). Defaults to true. Set
   * false for a link inside running text: it then keeps a permanent underline so it is never
   * distinguished by colour alone (WCAG 1.4.1).
   */
  arrow?: boolean;
}

/**
 * Tertiary editorial link. Standalone, it is the comp's "label + sliding arrow" link: brand
 * colour, semibold, underline on hover. Inline (`arrow={false}`), it is an underlined text link.
 * A plain `<a>`; the app decides routing. Prefer concrete labels ("Read the case study") over
 * "Learn more".
 */
export function TextLink({ arrow = true, className, children, ...props }: TextLinkProps) {
  return (
    <a
      className={cx(
        "group inline-flex items-center gap-(--space-2) font-semibold text-tone-link underline-offset-4",
        "transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:text-tone-link-hover",
        arrow ? "no-underline hover:underline" : "underline",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {arrow ? <SlideArrow size={16} /> : null}
    </a>
  );
}
