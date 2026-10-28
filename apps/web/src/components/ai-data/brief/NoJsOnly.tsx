"use client";

import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const subscribe = () => () => undefined;

/**
 * Progressive enhancement for /ai-data/contact. The server HTML holds a no-script fallback (the
 * simple form) and a JavaScript-only placeholder; the CSS media feature `scripting` picks the
 * right one before any script runs (globals.css).
 *
 * `NoJsOnly`: server-rendered (so it works as a plain `<form>` POST), hidden by CSS when scripting
 * is enabled, and removed from the DOM once the page has hydrated so that its widgets (the human
 * check) never load for visitors who have JavaScript.
 */
export function NoJsOnly({ children }: Readonly<{ children: ReactNode }>) {
  const present = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  return present ? <div className="aid-no-js-only">{children}</div> : null;
}

/**
 * `JsOnly`: renders its children once JavaScript is running (false on the server and during
 * hydration, true afterwards). The placeholder is hidden when scripting is off.
 */
export function JsOnly({ children }: Readonly<{ children: ReactNode }>) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return ready ? <>{children}</> : <div aria-hidden="true" className="aid-needs-js min-h-96" />;
}
