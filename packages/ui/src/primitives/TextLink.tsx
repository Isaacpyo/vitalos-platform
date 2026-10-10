import type { AnchorHTMLAttributes } from "react";
import { cx } from "./_internal/cx";
import { Icon } from "./Icon";

export interface TextLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /** Directional arrow after the label (editorial navigation). Defaults to true. */
  arrow?: boolean;
}

/**
 * Tertiary editorial link: underlined text with an optional directional indicator. A plain
 * `<a>`; the app decides routing. Prefer concrete labels ("Read the case study") over "Learn more".
 */
export function TextLink({ arrow = true, className, children, ...props }: TextLinkProps) {
  return (
    <a
      className={cx(
        "group inline-flex items-center gap-(--space-2) font-semibold text-tone-link underline underline-offset-4",
        "transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:text-tone-link-hover",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {arrow ? (
        <Icon
          name="arrow-right"
          size={16}
          className="shrink-0 transition-transform duration-(--duration-feedback) ease-(--ease-standard) group-hover:translate-x-0.5"
        />
      ) : null}
    </a>
  );
}
