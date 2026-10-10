import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./_internal/cx";

export interface StatProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** The figure itself, exactly as it appears in the evidence. */
  value: string;
  /** Precise description of what the figure measures. */
  descriptor: ReactNode;
  /**
   * Where the figure comes from (report, engagement, date). REQUIRED: an unsourced stat is a
   * vanity counter (Stage 9 section 16) and renders nothing.
   */
  source: NonNullable<ReactNode>;
  /** Scope or timeframe that qualifies the figure. */
  context?: ReactNode;
}

const isBlank = (node: ReactNode): boolean =>
  node === null ||
  node === undefined ||
  node === false ||
  (typeof node === "string" && node.trim() === "");

/** Large number, precise descriptor, mandatory source. */
export function Stat({ value, descriptor, source, context, className, ...props }: StatProps) {
  if (isBlank(source) || isBlank(value) || isBlank(descriptor)) return null;
  return (
    <div className={cx("flex flex-col gap-(--space-2)", className)} {...props}>
      <p className="text-display-l text-tone-heading">{value}</p>
      <p className="text-body font-medium text-tone-text">{descriptor}</p>
      {isBlank(context) ? null : <p className="text-small text-tone-muted">{context}</p>}
      <p className="text-small text-tone-muted">
        <span className="font-medium">Source:</span> {source}
      </p>
    </div>
  );
}
