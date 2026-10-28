"use client";

import { Toast as BaseToast } from "@base-ui/react/toast";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { cx } from "../primitives/_internal/cx";
import { Icon } from "../primitives/Icon";
import { iconButton, popupSurface } from "./_surface";
import { ToastContext } from "./toast-context";
import type { ToastApi, ToastTone } from "./toast-context";

/**
 * Toasts (Base UI): short, polite confirmations such as "Copied". They live in a labelled
 * region, are announced by screen readers, can be dismissed with a button (44px) and stop their
 * timer while hovered or focused. A toast never carries the only copy of something important and
 * never asks for a decision. Mount `ToastProvider` once near the root of the island that needs it.
 *
 * ```tsx
 * const toast = useToast();
 * toast.show({ title: "Copied", tone: "success" });
 * ```
 */
export { useOptionalToast, useToast } from "./toast-context";
export type { ShowToastOptions, ToastApi, ToastTone } from "./toast-context";
const toneIcon = { neutral: "info", success: "success", error: "error" } as const;

function ToastList() {
  const { toasts } = BaseToast.useToastManager();
  return toasts.map((toast) => {
    const tone = (toast.type as ToastTone | undefined) ?? "neutral";
    return (
      <BaseToast.Root
        key={toast.id}
        toast={toast}
        className={cx(
          popupSurface,
          "mt-(--space-2) flex w-full items-start gap-(--space-3) p-(--space-3) pl-(--space-4)",
          "transition-[opacity,translate] duration-(--duration-reveal) ease-(--ease-emphasis)",
          "data-starting-style:translate-y-2 data-starting-style:opacity-0 data-ending-style:opacity-0",
          tone === "error" && "border-tone-control-border",
        )}
      >
        <Icon name={toneIcon[tone]} size={20} className="mt-2.5 shrink-0 text-tone-accent" />
        <BaseToast.Content className="flex min-w-0 flex-1 flex-col py-(--space-2)">
          <BaseToast.Title className="m-0 text-body font-semibold text-tone-heading" />
          <BaseToast.Description className="m-0 text-small text-tone-muted" />
        </BaseToast.Content>
        <BaseToast.Close className={iconButton} aria-label="Dismiss notification">
          <Icon name="close" size={16} />
        </BaseToast.Close>
      </BaseToast.Root>
    );
  });
}

function Bridge({ children }: Readonly<{ children: ReactNode }>) {
  const manager = BaseToast.useToastManager();
  const api = useMemo<ToastApi>(
    () => ({
      show: ({ title, description, tone = "neutral", timeout = 4000 }) =>
        manager.add({ title, description, type: tone, timeout }),
      close: (id) => manager.close(id),
    }),
    [manager],
  );
  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}

export interface ToastProviderProps {
  children: ReactNode;
  /**
   * Extra attributes for the viewport, which renders in a portal outside any band: pass the page
   * tone here, e.g. `{ "data-aid-tone": "dark" }`.
   */
  viewportAttributes?: Record<`data-${string}`, string>;
}

export function ToastProvider({ children, viewportAttributes }: ToastProviderProps) {
  return (
    <BaseToast.Provider limit={3}>
      <Bridge>{children}</Bridge>
      <BaseToast.Portal>
        <BaseToast.Viewport
          aria-label="Notifications"
          className="fixed right-(--space-3) bottom-(--space-3) z-60 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col sm:right-(--space-6) sm:bottom-(--space-6)"
          {...viewportAttributes}
        >
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}
