"use client";

import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import type { ReactNode } from "react";
import { cx } from "../primitives/_internal/cx";
import { Icon } from "../primitives/Icon";
import { iconButton, popupSurface } from "./_surface";

/**
 * Drawer (Base UI): a modal panel that slides in from the right (or up from the bottom as a
 * sheet on phones), with swipe-to-dismiss on touch. Same focus contract as Dialog: trapped while
 * open, Escape closes, focus returns to the trigger. Under reduced motion the slide is instant.
 */
export type DrawerSide = "right" | "bottom";

export interface DrawerProps extends Omit<BaseDrawer.Root.Props, "swipeDirection"> {
  /** Edge it enters from. `right` (default) suits detail panels; `bottom` suits phones. */
  side?: DrawerSide;
}

export function Drawer({ side = "right", ...props }: DrawerProps) {
  return <BaseDrawer.Root swipeDirection={side === "bottom" ? "down" : "right"} {...props} />;
}

export type DrawerTriggerProps = Omit<BaseDrawer.Trigger.Props, "className"> & {
  className?: string;
};

export function DrawerTrigger({ className, ...props }: DrawerTriggerProps) {
  return <BaseDrawer.Trigger className={className} {...props} />;
}

export const DrawerClose = BaseDrawer.Close;

export interface DrawerContentProps extends Omit<
  BaseDrawer.Popup.Props,
  "className" | "title" | "children"
> {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  side?: DrawerSide;
  closeLabel?: string;
  className?: string;
}

const slide = {
  right:
    "h-full w-[min(32rem,100vw)] rounded-r-none border-y-0 border-r-0 [transform:translateX(var(--drawer-swipe-movement-x,0px))] data-starting-style:[transform:translateX(100%)] data-ending-style:[transform:translateX(100%)]",
  bottom:
    "max-h-[88dvh] w-full rounded-b-none border-x-0 border-b-0 [transform:translateY(var(--drawer-swipe-movement-y,0px))] data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)]",
} as const;

export function DrawerContent({
  title,
  description,
  children,
  side = "right",
  closeLabel = "Close",
  className,
  ...props
}: DrawerContentProps) {
  return (
    <BaseDrawer.Portal>
      <BaseDrawer.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-(--duration-disclosure) ease-(--ease-standard) data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <BaseDrawer.Viewport
        className={cx(
          "fixed inset-0 z-50 flex",
          side === "right" ? "items-stretch justify-end" : "items-end justify-center",
        )}
      >
        <BaseDrawer.Popup
          className={cx(
            popupSurface,
            "flex flex-col overflow-y-auto overscroll-contain p-(--space-5) transition-transform duration-(--duration-disclosure) ease-(--ease-emphasis) data-swiping:select-none data-swiping:duration-0 sm:p-(--space-6)",
            slide[side],
            className,
          )}
          {...props}
        >
          <BaseDrawer.Content className="flex flex-col gap-(--space-4)">
            <div className="flex items-start justify-between gap-(--space-4)">
              <div className="flex min-w-0 flex-col gap-(--space-1)">
                <BaseDrawer.Title className="m-0 text-h3 text-tone-heading">
                  {title}
                </BaseDrawer.Title>
                {description ? (
                  <BaseDrawer.Description className="m-0 text-small text-tone-muted">
                    {description}
                  </BaseDrawer.Description>
                ) : null}
              </div>
              <BaseDrawer.Close className={cx(iconButton, "-mt-2 -mr-2")} aria-label={closeLabel}>
                <Icon name="close" />
              </BaseDrawer.Close>
            </div>
            {children}
          </BaseDrawer.Content>
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
    </BaseDrawer.Portal>
  );
}
