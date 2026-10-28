"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../primitives/_internal/cx";
import { Icon } from "../primitives/Icon";
import { focusRing } from "./_surface";
import { useOptionalToast } from "./toast-context";

export type CopyState = "idle" | "copied" | "failed";

export interface CopyButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "children" | "value"
> {
  /** The text to copy. Compute it at click time with a function if it is large. */
  value: string | (() => string);
  label?: string;
  copiedLabel?: string;
  failedLabel?: string;
  /** Also show a toast when a ToastProvider is mounted. */
  toast?: boolean;
  /** Called after a successful copy. */
  onCopied?: () => void;
  /** How long the "Copied" state shows. Default 2000 ms. */
  resetAfterMs?: number;
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copy-to-clipboard button with visible and announced confirmation: the label changes to
 * "Copied" (or "Copy failed") and a polite live region says so, so the result is not conveyed by
 * an icon or colour alone. Reverts after `resetAfterMs`. A failure is reported, never swallowed.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  failedLabel = "Copy failed",
  toast = false,
  onCopied,
  resetAfterMs = 2000,
  className,
  type = "button",
  ...props
}: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toaster = useOptionalToast();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    const text = typeof value === "function" ? value() : value;
    const ok = await writeClipboard(text);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), resetAfterMs);
    if (ok) onCopied?.();
    if (toast && toaster) {
      toaster.show(
        ok
          ? { title: copiedLabel, tone: "success", timeout: 2500 }
          : {
              title: failedLabel,
              description: "Select the text and copy it manually.",
              tone: "error",
            },
      );
    }
  }, [value, resetAfterMs, onCopied, toast, toaster, copiedLabel, failedLabel]);

  const visible = state === "copied" ? copiedLabel : state === "failed" ? failedLabel : label;
  return (
    <>
      <button
        type={type}
        onClick={() => void copy()}
        data-state={state}
        className={cx(
          "inline-flex min-h-11 items-center gap-(--space-2) rounded-md border border-tone-control-border bg-transparent px-(--space-4) text-small font-semibold text-tone-heading",
          "transition-colors duration-(--duration-feedback) hover:bg-tone-tile-bg active:translate-y-px",
          "data-[state=copied]:border-tone-accent data-[state=failed]:border-tone-accent",
          focusRing,
          className,
        )}
        {...props}
      >
        <Icon
          name={state === "copied" ? "check" : state === "failed" ? "warning" : "copy"}
          size={16}
        />
        <span>{visible}</span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "idle" ? "" : visible}
      </span>
    </>
  );
}
