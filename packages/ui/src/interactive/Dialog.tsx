"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { cx } from "../primitives/_internal/cx";
import { Icon } from "../primitives/Icon";
import { iconButton, popupMotion, popupSurface } from "./_surface";

/**
 * Modal dialog (Base UI): traps focus, makes the rest of the page inert, closes on Escape, and
 * returns focus to the trigger. A visible Close button is always present (touch target 44px).
 * Use for an expanded view of something already on the page, never to hide required content.
 * Portalled content is outside any band: pass the page's tone attribute (`data-aid-tone`).
 */
export const Dialog = BaseDialog.Root;

export type DialogTriggerProps = Omit<BaseDialog.Trigger.Props, "className"> & {
  className?: string;
};

export function DialogTrigger({ className, ...props }: DialogTriggerProps) {
  return <BaseDialog.Trigger className={className} {...props} />;
}

export const DialogClose = BaseDialog.Close;

export interface DialogContentProps extends Omit<
  BaseDialog.Popup.Props,
  "className" | "title" | "children"
> {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** `wide` for work surfaces (the expanded demonstration). */
  size?: "default" | "wide";
  closeLabel?: string;
  className?: string;
}

export function DialogContent({
  title,
  description,
  children,
  size = "default",
  closeLabel = "Close",
  className,
  ...props
}: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-(--duration-reveal) ease-(--ease-standard) data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <BaseDialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-(--space-3) sm:p-(--space-6)">
        <BaseDialog.Popup
          className={cx(
            popupSurface,
            popupMotion,
            "relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col gap-(--space-4) overflow-y-auto p-(--space-5) sm:p-(--space-6)",
            size === "wide" ? "max-w-5xl" : "max-w-lg",
            className,
          )}
          {...props}
        >
          <div className="flex items-start justify-between gap-(--space-4)">
            <div className="flex min-w-0 flex-col gap-(--space-1)">
              <BaseDialog.Title className="m-0 text-h3 text-tone-heading">{title}</BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="m-0 text-small text-tone-muted">
                  {description}
                </BaseDialog.Description>
              ) : null}
            </div>
            <BaseDialog.Close className={cx(iconButton, "-mt-2 -mr-2")} aria-label={closeLabel}>
              <Icon name="close" />
            </BaseDialog.Close>
          </div>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}
