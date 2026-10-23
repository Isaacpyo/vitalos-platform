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
 * `ASKBRIDGE_SITE_KEY` is set. A plain server-rendered `<script async>` (the embed Askbridge
 * documents), not `next/script`: it adds no client JavaScript to the site's own bundles (the JS
 * budgets in tests/performance/budgets.json), and `async` never blocks parsing or the hero image
 * (LCP). The loader waits for <body> if it runs first, and loads its panel only on intent.
 */
export function AskbridgeScript({ siteKey, origin }: AskbridgeScriptProps) {
  return (
    <script id="askbridge-widget" src={askbridgeScriptSrc(origin)} data-site={siteKey} async />
  );
}
