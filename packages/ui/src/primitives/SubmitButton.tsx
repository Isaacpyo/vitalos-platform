"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonSize, type ButtonTheme } from "./Button";

export interface SubmitButtonProps {
  children: ReactNode;
  /** Label while the surrounding form action is pending. Defaults to the normal label. */
  pendingLabel?: ReactNode;
  size?: ButtonSize;
  theme?: ButtonTheme;
  className?: string;
}

/**
 * Submit button that reads the pending state of its parent `<form action>` via useFormStatus.
 * While pending it stays focusable (aria-disabled, not `disabled`), blocks repeat submits, sets
 * aria-busy and swaps to `pendingLabel` so progress is communicated (Stage 9 section 15).
 */
export function SubmitButton({
  children,
  pendingLabel,
  size = "lg",
  theme,
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) event.preventDefault();
  };
  return (
    <Button
      type="submit"
      variant="primary"
      size={size}
      {...(theme ? { theme } : {})}
      {...(className ? { className } : {})}
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      onClick={onClick}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
