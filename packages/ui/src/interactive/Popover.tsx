"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import type { ReactNode } from "react";
import { cx } from "../primitives/_internal/cx";
import { popupMotion, popupSurface } from "./_surface";

/**
 * Popover (Base UI): a non-modal popup anchored to the button that opens it, for a short
 * explanation. Opens on click or Enter/Space, closes on Escape or an outside click and returns
 * focus to the trigger. Nothing essential may live only in a popover: the same words must be
 * reachable on the page.
 *
 * ```tsx
 * <Popover>
 *   <PopoverTrigger>Why is this flagged?</PopoverTrigger>
 *   <PopoverContent title="Amount mismatch" data-aid-tone="dark">The ledger shows £398.00.</PopoverContent>
 * </Popover>
 * ```
 */
export const Popover = BasePopover.Root;

export type PopoverTriggerProps = Omit<BasePopover.Trigger.Props, "className"> & {
  className?: string;
};

export function PopoverTrigger({ className, ...props }: PopoverTriggerProps) {
  return <BasePopover.Trigger className={className} {...props} />;
}

export interface PopoverContentProps extends Omit<
  BasePopover.Popup.Props,
  "className" | "title" | "children"
> {
  /** Accessible name of the popup; shown as its heading. */
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export function PopoverContent({
  title,
  description,
  children,
  className,
  side = "bottom",
  align = "center",
  ...props
}: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className="z-50"
      >
        <BasePopover.Popup
          className={cx(
            popupSurface,
            popupMotion,
            "flex w-[min(22rem,calc(100vw-1.5rem))] origin-(--transform-origin) flex-col gap-(--space-2) p-(--space-4)",
            className,
          )}
          {...props}
        >
          <BasePopover.Title className="m-0 text-body font-semibold text-tone-heading">
            {title}
          </BasePopover.Title>
          {description ? (
            <BasePopover.Description className="m-0 text-small text-tone-muted">
              {description}
            </BasePopover.Description>
          ) : null}
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

export const PopoverClose = BasePopover.Close;
