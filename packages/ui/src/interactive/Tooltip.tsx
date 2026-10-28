"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";
import { cx } from "../primitives/_internal/cx";
import { popupMotion } from "./_surface";

/**
 * Tooltip (Base UI): supplementary hover and keyboard-focus label for an icon control. It is
 * never the only place a fact appears, and touch users do not get it: use Popover for anything
 * that must be tappable.
 */
export const TooltipProvider = BaseTooltip.Provider;

export interface TooltipProps {
  /** The element to describe. Rendered as the trigger (merged, no wrapper). */
  children: ReactElement<Record<string, unknown>>;
  content: ReactNode;
  className?: string;
}

export function Tooltip({ children, content, className }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={6} className="z-50">
          <BaseTooltip.Popup
            className={cx(
              popupMotion,
              "max-w-64 origin-(--transform-origin) rounded-md bg-tone-heading px-(--space-3) py-(--space-1) text-small text-tone-bg",
              className,
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
