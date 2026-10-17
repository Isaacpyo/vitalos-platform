"use client";

import { useEffect, useState } from "react";
import { Button } from "@vitalos/ui";

/** The Relay launcher's button (`@vitalos/relay-widget` launcher.tsx). */
const LAUNCHER = "button.relay-launcher";

/**
 * Opens the Relay assistant from a page (the 404 and the FAQ; findings B10 and B12). Render it only
 * where Relay is enabled for the deployment (`getFeatures().relay`). It appears after hydration
 * and only when the launcher is on the page, so without JavaScript nothing dead is shown; pressing
 * it presses the launcher, which loads and opens the panel as usual.
 */
export function AskRelayButton({ label }: Readonly<{ label: string }>) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(document.querySelector(LAUNCHER) !== null);
  }, []);
  if (!ready) return null;
  return (
    <Button
      variant="text"
      onClick={() => {
        const launcher = document.querySelector<HTMLButtonElement>(LAUNCHER);
        if (launcher && launcher.getAttribute("aria-expanded") !== "true") launcher.click();
      }}
    >
      {label}
    </Button>
  );
}
