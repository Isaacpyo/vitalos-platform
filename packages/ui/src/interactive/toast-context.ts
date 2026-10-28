"use client";

import { createContext, useContext } from "react";

/**
 * The toast API and its context, kept apart from the Base UI provider so that components that
 * only offer an optional toast (CopyButton) do not pull Base UI into a bundle that never mounts
 * a provider.
 */
export type ToastTone = "neutral" | "success" | "error";

export interface ShowToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it closes itself. Default 4000. */
  timeout?: number;
}

export interface ToastApi {
  show: (options: ShowToastOptions) => string;
  close: (id?: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Throws outside a ToastProvider. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

/** Null outside a ToastProvider, for components that offer a toast only when one is available. */
export function useOptionalToast(): ToastApi | null {
  return useContext(ToastContext);
}
