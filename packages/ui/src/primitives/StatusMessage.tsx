import type { ReactNode } from "react";
import { cx } from "./_internal/cx";
import { Icon, type IconName } from "./Icon";
import { VisuallyHidden } from "./VisuallyHidden";

export type StatusVariant = "info" | "success" | "warning" | "error";

const variants: Record<
  StatusVariant,
  { icon: IconName; border: string; text: string; label: string }
> = {
  info: {
    icon: "info",
    border: "border-tone-border",
    text: "text-tone-heading",
    label: "Information",
  },
  success: { icon: "success", border: "border-success", text: "text-success", label: "Success" },
  warning: { icon: "warning", border: "border-warning", text: "text-warning", label: "Warning" },
  error: { icon: "error", border: "border-danger", text: "text-danger", label: "Error" },
};

export interface StatusMessageProps {
  variant?: StatusVariant;
  /** Optional bold lead line. */
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Polite live region (`role="status"`) for submission progress and outcomes. Colour is never the
 * only signal: every variant has an icon and a visually hidden text label. Render the region
 * before the message appears so assistive technology announces the change.
 */
export function StatusMessage({
  variant = "info",
  title,
  children,
  className,
}: StatusMessageProps) {
  const v = variants[variant];
  return (
    <div
      role="status"
      className={cx(
        "flex items-start gap-(--space-3) rounded-sm border-2 p-(--space-4)",
        v.border,
        className,
      )}
    >
      <Icon name={v.icon} size={20} className={cx("mt-0.5 shrink-0", v.text)} />
      <div className="text-body text-tone-text">
        <VisuallyHidden>{v.label}: </VisuallyHidden>
        {title ? <p className={cx("font-semibold", v.text)}>{title}</p> : null}
        {children ? <div className={title ? "mt-(--space-1)" : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}
