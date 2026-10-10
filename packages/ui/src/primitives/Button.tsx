import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cx } from "./_internal/cx";

export type ButtonVariant = "primary" | "secondary" | "text";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonTheme = "light" | "dark";

interface ButtonOwnProps {
  /** primary: the one dominant action in a region; secondary: quieter; text: editorial/inline. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Forces the verified contrast treatment for the surface the button sits on. Omit inside a
   * Section: the button already follows the section tone.
   */
  theme?: ButtonTheme;
}

export type ButtonAsLinkProps = ButtonOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "color"> & { href: string };

export type ButtonAsButtonProps = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & { href?: undefined };

export type ButtonProps = ButtonAsLinkProps | ButtonAsButtonProps;

const base =
  "inline-flex items-center justify-center gap-(--space-2) rounded-sm font-semibold no-underline " +
  "transition-colors duration-(--duration-feedback) ease-(--ease-standard) select-none";

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-(--size-button-sm) px-(--space-4) text-small",
  md: "min-h-(--size-button-md) px-(--space-5) text-body",
  lg: "min-h-(--size-button-lg) px-(--space-6) text-body-l",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-tone-action text-tone-action-text " +
    "hover:bg-tone-action-hover active:translate-y-px active:bg-tone-action-hover " +
    "disabled:cursor-not-allowed disabled:border-tone-border disabled:bg-tone-border disabled:text-tone-muted " +
    "disabled:hover:bg-tone-border disabled:active:translate-y-0",
  secondary:
    "border border-tone-heading bg-transparent text-tone-heading " +
    "hover:bg-tone-heading hover:text-tone-bg active:translate-y-px active:bg-tone-heading active:text-tone-bg " +
    "disabled:cursor-not-allowed disabled:border-tone-border disabled:text-tone-muted " +
    "disabled:hover:bg-transparent disabled:hover:text-tone-muted disabled:active:translate-y-0",
  text:
    "border border-transparent px-0 text-tone-link underline underline-offset-4 " +
    "hover:text-tone-link-hover active:text-tone-link-hover " +
    "disabled:cursor-not-allowed disabled:text-tone-muted disabled:no-underline",
};

/**
 * Button. Renders a plain `<a>` when `href` is given (navigation) and a `<button>` otherwise
 * (action). Defines default, hover, focus-visible (global, from theme.css), pressed and disabled
 * states. There is no disabled link: unavailable navigation should not be published.
 */
export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", theme, className, ...rest } = props;
  const classes = cx(
    base,
    variant !== "text" && sizes[size],
    variant === "text" && "min-h-0 text-body",
    variants[variant],
    className,
  );
  if (rest.href !== undefined) {
    const { href, ...anchor } = rest as Omit<ButtonAsLinkProps, keyof ButtonOwnProps | "className">;
    return <a href={href} data-tone={theme} className={classes} {...anchor} />;
  }
  const { type = "button", ...button } = rest as Omit<
    ButtonAsButtonProps,
    keyof ButtonOwnProps | "className"
  >;
  return <button type={type} data-tone={theme} className={classes} {...button} />;
}
