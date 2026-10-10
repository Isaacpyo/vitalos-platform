"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { cx } from "./_internal/cx";
import { Icon } from "./Icon";
import { VisuallyHidden } from "./VisuallyHidden";

interface FieldControlContext {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldControlContext | null>(null);

interface OwnControlProps {
  id?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling" | undefined;
  required?: boolean | undefined;
}

/**
 * Merges the surrounding Field's id, description and validity onto a control's own props. Controls
 * (TextInput, Textarea, Select) call this so a Field wires label, hint and error automatically;
 * they still work standalone.
 */
export function useFieldControl(own: OwnControlProps) {
  const ctx = useContext(FieldContext);
  const describedBy = [ctx?.describedBy, own["aria-describedby"]].filter(Boolean).join(" ");
  return {
    id: ctx?.id ?? own.id,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": ctx?.invalid ? (true as const) : own["aria-invalid"],
    required: own.required ?? (ctx?.required ? true : undefined),
  };
}

export interface FieldProps {
  /** Visible, persistent label. Placeholders are supplementary only (Stage 9 section 15). */
  label: ReactNode;
  /** Supporting hint, announced with the control through aria-describedby. */
  hint?: ReactNode;
  /** Error message that explains how to fix the problem. Sets aria-invalid on the control. */
  error?: ReactNode;
  /** Marks the control required (native `required`). */
  required?: boolean;
  /** Shows the optional marker beside the label. Prefer this to asterisks. */
  optional?: boolean;
  /** Text for the optional marker. */
  optionalText?: string;
  /** Override the generated control id. */
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Label, hint and error wrapper for a single control. Associates them with the control through
 * `htmlFor`, `aria-describedby` and `aria-invalid`.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  optionalText = "(optional)",
  id,
  className,
  children,
}: FieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const value: FieldControlContext = {
    id: controlId,
    describedBy,
    invalid: Boolean(error),
    required,
  };

  return (
    <div className={cx("flex flex-col gap-(--space-2)", className)}>
      <label htmlFor={controlId} className="text-body font-semibold text-tone-heading">
        {label}
        {optional ? (
          <span className="ml-(--space-2) font-normal text-tone-muted">{optionalText}</span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-small text-tone-muted">
          {hint}
        </p>
      ) : null}
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
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
