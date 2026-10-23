import Script from "next/script";

/** Path of the widget loader on the Askbridge origin. It loads `panel.js` from the same directory. */
export const ASKBRIDGE_SCRIPT_PATH = "/widget/v1/askbridge.js";

export interface AskbridgeScriptProps {
  /** Public site key (`pk_` and 32 hex characters). Public by design; checked against origins. */
  siteKey: string;
  /** https origin of the Askbridge service. */
  origin: string;
}

/** The `src` of the loader script for an origin (a bare https origin, no trailing slash). */
export const askbridgeScriptSrc = (origin: string) => `${origin}${ASKBRIDGE_SCRIPT_PATH}`;

/**
 * The Askbridge assistant (ADR-045): one script tag, rendered once from the root layout when
 * `ASKBRIDGE_SITE_KEY` is set. `lazyOnload` injects it after the window load event and in idle
 * time, so it cannot compete with the hero image (LCP) or add main-thread work during early
 * interaction (INP, docs/seo/DECISIONS.md 15). The widget itself loads its panel on click.
 */
export function AskbridgeScript({ siteKey, origin }: AskbridgeScriptProps) {
  return (
    <Script
      id="askbridge-widget"
      src={askbridgeScriptSrc(origin)}
      data-site={siteKey}
      strategy="lazyOnload"
    />
  );
}
