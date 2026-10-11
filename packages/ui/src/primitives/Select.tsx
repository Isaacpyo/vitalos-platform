"use client";

import type { ComponentPropsWithoutRef } from "react";
import { controlClasses } from "./_internal/control";
import { cx } from "./_internal/cx";
import { useFieldControl } from "./Field";

export type SelectProps = ComponentPropsWithoutRef<"select">;

/** Native select: full keyboard and screen reader support with no custom listbox to maintain. */
export function Select({ className, children, ...props }: SelectProps) {
  const wired = useFieldControl(props);
  return (
    <select {...props} {...wired} className={cx(controlClasses, className)}>
      {children}
    </select>
  );
}
