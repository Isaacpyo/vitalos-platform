"use client";

import { useEffect } from "react";
import { legacyAnchorTarget } from "../features/redirects/legacy-anchors";

/**
 * Sends a visitor who arrives on the homepage with a fragment from the earlier single-page site
 * (`/#what-we-do`, `/#about`, …) to the page that now holds that content. Fragments never reach
 * the server, so this cannot be a 308. `replace`, so Back does not return to the dead fragment.
 * Renders nothing.
 */
export function LegacyAnchorRedirect() {
  useEffect(() => {
    const target = legacyAnchorTarget(window.location.hash, (id) =>
      Boolean(document.getElementById(id)),
    );
    if (target) window.location.replace(target);
  }, []);
  return null;
}
