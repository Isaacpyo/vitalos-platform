import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cx } from "./_internal/cx";
import { Icon } from "./Icon";
import { VisuallyHidden } from "./VisuallyHidden";

export interface CheckboxProps extends Omit<ComponentPropsWithoutRef<"input">, "type"> {
  /** Visible label. May contain a link, for example to the privacy notice. */
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/**
 * Checkbox with its own label, hint and error (consent acknowledgements). Never pre-tick consent
 * (Stage 9 section 15): do not pass `defaultChecked` for it.
 */
export function Checkbox({
  label,
  hint,
  error,
  id,
  className,
  "aria-describedby": describedByProp,
  ...props
}: CheckboxProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId, describedByProp].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-(--space-2)", className)}>
      <div className="flex items-start gap-(--space-3)">
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input
            {...props}
            id={controlId}
            type="checkbox"
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={cx(
              "peer size-6 cursor-pointer appearance-none rounded-sm border border-tone-control-border bg-tone-control-bg",
              "checked:border-tone-action checked:bg-tone-action",
              "aria-invalid:border-2 aria-invalid:border-danger",
              "disabled:cursor-not-allowed disabled:border-tone-border disabled:bg-tone-border",
            )}
          />
          <Icon
            name="check"
            size={20}
            className="pointer-events-none absolute inset-0 m-auto hidden text-tone-action-text peer-checked:block"
          />
        </span>
        <label htmlFor={controlId} className="text-body text-tone-text">
          {label}
        </label>
      </div>
      {hint ? (
        <p id={hintId} className="ml-9 text-small text-tone-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-(--space-2) text-small text-danger">
          <Icon name="error" size={16} className="mt-0.5 shrink-0" />
          <span>
            <VisuallyHidden>Error: </VisuallyHidden>
            {error}
          </span>
        </p>
      ) : null}
    </div>
  );
}
