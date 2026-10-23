# ADR 045 The public site's assistant moves from Relay to Askbridge

Status: Proposed (engineering, 23 October 2026). Owner decision of 23 October 2026: replace the site's own "Ask Vitalos" assistant with the Askbridge widget. Nothing changes in production until the pull request merges and the environment variable below is set.

## Context

vitalos.co.uk runs Vitalos Relay (ADR-035 to ADR-038), mounted in the root layout behind `RELAY_ENABLED`. Askbridge by Vitalos is the new product built from Relay. A "Vitalos" workspace already exists on it and reads vitalos.co.uk. Vitalos should use its own product on its own site.

Askbridge embeds with one script tag:

```html
<script
  src="https://askbridge.vitalos.co.uk/widget/v1/askbridge.js"
  data-site="pk_..."
  async
></script>
```

The site key is public by design: it is sent as a header and checked against the workspace's allowed origins. At runtime the script loads `panel.js` from the same directory, calls `/api/v1/visitor/...` on the Askbridge origin (fetch and SSE), may show a logo from that origin, and may load Cloudflare Turnstile (script and frame) when the workspace has it on.

## Decision

1. **Two optional values in `@vitalos/config`.** `ASKBRIDGE_SITE_KEY` must match `^pk_[a-f0-9]{32}$` when set. `ASKBRIDGE_ORIGIN` is an https origin and defaults to `https://askbridge.vitalos.co.uk`. Both are non-secret and read at build time through `readBuildEnv().askbridge`, which is undefined when the key is unset. Invalid values fail the build, and errors never echo the value.
2. **The key switches the assistant.** With the key set, the root layout renders one plain `<script async>` tag (`src` from the origin, `data-site` from the key) and does not render `RelayLauncher`. With the key unset, the layout is exactly as before: Relay renders when `RELAY_ENABLED` is on.
3. **A plain `<script async>`, not `next/script`.** `next/script` adds its loader to the site's own client bundles on every page, which breaks the first-party JS budgets (ADR-021) by a few hundred bytes. A server-rendered async script costs no first-party JS, never blocks parsing or the hero image (LCP, docs/seo/DECISIONS.md 15), and is the embed Askbridge documents. The widget is a small launcher that waits for `<body>` and loads its panel only on intent.
4. **CSP, only when the key is set** (`buildCsp` input `askbridgeOrigin`, set from `apps/web/src/config/security-headers.ts`):
   - `script-src`: the Askbridge origin and `https://challenges.cloudflare.com`.
   - `connect-src`: the Askbridge origin.
   - `img-src`: the Askbridge origin (logos).
   - `frame-src`: `https://challenges.cloudflare.com` (it is `'none'` otherwise).
   - Turnstile is allowed even when this site's own Turnstile keys are off, because the widget may load it. The site's own contact-form Turnstile behaviour is unchanged.
   - Nothing else changes: `frame-ancestors 'none'`, `default-src 'self'`, `style-src` (the widget's inline styles already fit `'unsafe-inline'`) and `form-action 'self'` stay as they were. With the key unset the policy is byte-for-byte what it was.
5. **Relay stays in the repo.** Packages, routes, tables and docs are untouched. The Relay API routes still answer if `RELAY_ENABLED` is on; only the launcher is not rendered.

## Rollback

Unset `ASKBRIDGE_SITE_KEY` in the Vercel production project and redeploy (it is a build-time value). The launcher and the previous CSP return with no code change. A code revert of the pull request does the same. No data migration is involved.

## Alternatives considered

- **Runtime configuration without a rebuild.** Not chosen: the CSP is built in `next.config.ts` at build time, so a rebuild is needed anyway.
- **A separate on/off flag besides the key.** Not chosen: two values that must agree can drift. The key is the switch.
- **A client-side wrapper that checks the origin.** Not chosen: the Askbridge server already checks the key against allowed origins.

## Consequences

- The public site makes a third-party request to `askbridge.vitalos.co.uk` (a Vitalos service) after load. The privacy notice and sub-processor list should name Askbridge as the assistant provider; this is for the owner and a lawyer to confirm before the key is set in production.
- If Askbridge is down, the widget does not appear; the page is unaffected.
- The CI job `e2e-askbridge` builds the site with a made-up key and an unresolvable origin, intercepts the request, and checks the script tag, the CSP and the absence of the Relay launcher. No test depends on the live service.

## Revisit triggers

Relay is no longer needed anywhere (retire `RelayLauncher` and the Relay routes); Askbridge gains a first-party script path on vitalos.co.uk; the widget starts needing other origins.
