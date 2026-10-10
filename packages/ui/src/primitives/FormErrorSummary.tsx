"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./_internal/cx";
import { Icon } from "./Icon";

export interface FormError {
  /** Id of the invalid control; the message links to it. */
  fieldId: string;
  message: ReactNode;
}

export interface FormErrorSummaryProps {
  errors: ReadonlyArray<FormError>;
  /** Summary heading. */
  title?: string;
  /**
   * Change this (for example a submission counter) to move focus to the summary again when a new
   * submission fails with the same number of errors.
   */
  focusKey?: unknown;
  className?: string;
}

/**
 * Lists every validation error with a link to its field. Receives focus when errors appear so
 * keyboard and screen reader users land on it (WCAG 3.3.1); renders nothing when there are none.
 * Use alongside inline Field errors, not instead of them.
 */
export function FormErrorSummary({
  errors,
  title = "There is a problem",
  focusKey,
  className,
}: FormErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const count = errors.length;
  useEffect(() => {
    if (count > 0) ref.current?.focus();
  }, [count, focusKey]);

  if (count === 0) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cx("rounded-sm border-2 border-danger bg-tone-bg p-(--space-5)", className)}
    >
      <p
        id={titleId}
        className="flex items-center gap-(--space-2) text-body font-semibold text-danger"
      >
        <Icon name="error" size={20} className="shrink-0" />
        {title}
      </p>
      <ul className="mt-(--space-3) flex list-none flex-col gap-(--space-2) p-0">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a
              href={`#${error.fieldId}`}
              className="text-body text-tone-link underline underline-offset-4 hover:text-tone-link-hover"
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
