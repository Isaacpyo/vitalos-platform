"use client";

import type { ComponentPropsWithoutRef } from "react";
import { controlClasses } from "./_internal/control";
import { cx } from "./_internal/cx";
import { useFieldControl } from "./Field";

export type TextareaProps = ComponentPropsWithoutRef<"textarea">;

/** Multi-line input for free text such as "What are you trying to achieve?". */
export function Textarea({ className, rows = 5, ...props }: TextareaProps) {
  const wired = useFieldControl(props);
  return (
    <textarea
      {...props}
      {...wired}
      rows={rows}
      className={cx(controlClasses, "resize-y", className)}
    />
  );
}
