"use client";

import type { ComponentPropsWithoutRef } from "react";
import { controlClasses } from "./_internal/control";
import { cx } from "./_internal/cx";
import { useFieldControl } from "./Field";

export type TextInputProps = ComponentPropsWithoutRef<"input">;

/**
 * Single-line input. Set the correct `type`, `autoComplete` and `inputMode` for mobile keyboards.
 * Inside a Field it picks up the label, hint and error wiring automatically.
 */
export function TextInput({ className, type = "text", ...props }: TextInputProps) {
  const wired = useFieldControl(props);
  return <input {...props} {...wired} type={type} className={cx(controlClasses, className)} />;
}
