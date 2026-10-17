"use client";

import { useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Button, Spinner } from "./Button";

export interface SubmissionDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** `sending` shows a spinner and cannot be dismissed; `success` shows `children` and a Close button. */
  phase: "sending" | "success";
  sendingTitle?: string;
  successTitle: string;
  /** Confirmation content, shown in the success phase. */
  children?: ReactNode;
  closeLabel?: string;
  /** Called when the visitor closes the success dialog. */
  onClose: () => void;
}

/**
 * Modal shown over a blurred, dimmed page while a form submission is in flight, then (optionally)
 * the confirmation. A native `<dialog>` supplies the focus trap, Escape handling and inert page;
 * focus returns to the control that was focused when it opened. Closing happens in a layout
 * effect so a form's own error-focus effect (a passive effect) runs afterwards and wins.
 */
export function SubmissionDialog({
  open,
  phase,
  sendingTitle = "Sending…",
  successTitle,
  children,
  closeLabel = "Close",
  onClose,
}: Readonly<SubmissionDialogProps>) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || typeof dialog.showModal !== "function") return;
    if (open && !dialog.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      // Native restoration is not guaranteed for a button that was disabled while the dialog was open.
      if (document.activeElement === document.body) opener.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape cannot abandon an in-flight submission; it dismisses the confirmation.
        event.preventDefault();
        if (phase === "success") onClose();
      }}
      className="fixed inset-0 m-auto w-[min(28rem,calc(100vw-2rem))] max-w-none rounded-md border border-border bg-white p-(--space-6) text-slate-900 shadow-floating backdrop:bg-midnight-950/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-(--space-4)">
        {phase === "sending" ? (
          <div role="status" className="flex items-center gap-(--space-3)">
            <span className="text-blue-600">
              <Spinner size={28} />
            </span>
            <h2 id={titleId} className="m-0 text-h3 text-midnight-950">
              {sendingTitle}
            </h2>
          </div>
        ) : (
          <>
            <h2 id={titleId} className="m-0 text-h3 text-midnight-950">
              {successTitle}
            </h2>
            <div className="text-body">{children}</div>
            <div>
              <Button size="md" onClick={onClose}>
                {closeLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
