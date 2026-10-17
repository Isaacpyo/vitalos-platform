# ADR 047 Content Security Policy and security headers, revisited for Next.js 16

Status: Accepted (engineering), 17 Oct 2026, review run WS5. Amends ADR-020 decisions 4 (HSTS) and 5–7 (CSP), and its rejected option on `X-Frame-Options`. HSTS preload is an owner decision and is not taken here.

## Context

Review finding C4: `script-src 'unsafe-inline'`, no `X-Frame-Options`, `frame-ancestors` not confirmed, and HSTS with `max-age` only. Production on 17 Oct sends `frame-ancestors 'none'` already. Its `Strict-Transport-Security: max-age=63072000` is Vercel's default for custom domains, not ours: `ENABLE_HSTS` is evidently not set in production, or our value would read `max-age=31536000`.

The Next.js 16.4 guide (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`) is explicit about nonces: "you must use dynamic rendering to add nonces". With nonces, static optimisation and ISR are disabled, Partial Prerendering is incompatible, and pages cannot be CDN-cached without extra configuration. Every public page on this site is static or ISR (ADR-018), and the homepage's simulated LCP is already the tightest budget (docs/seo/DECISIONS.md 15). ADR-020's SRI spike found that experimental SRI hashes only the external chunks. The inline bootstrap (`<script id="_R_">`) and the `self.__next_f.push` flight scripts stay inline and differ per page and per build, so a static header cannot list their hashes.

## Decision

1. **No nonce and no `strict-dynamic`.** They would make every page dynamic, losing the static and ISR rendering, CDN caching and LCP. That trade is not worth it for a site that runs no third-party script except Turnstile. `script-src` keeps `'self' 'unsafe-inline'`, plus Turnstile when it is configured.
2. **Close what can be closed without that cost:**
   - `script-src-attr 'none'`: no inline event-handler attributes (`onclick="…"`, `onerror="…"`), a common HTML-injection vector. React never renders them; inline `<script>` elements are unaffected;
   - `X-Frame-Options: DENY`, beside `frame-ancestors 'none'`, for browsers that predate CSP 2. The reason ADR-020 gave against it (the Sanity Studio Presentation frame) went with Sanity (ADR-028). The Super Admin's preview iframes load admin URLs, not the site;
   - `Cross-Origin-Opener-Policy: same-origin`, so no cross-origin window keeps a `window.opener` handle on the site. Share links open plain new tabs, and Turnstile runs in an iframe, not a popup, so neither is affected.
3. **HSTS is `max-age=63072000; includeSubDomains`, still behind `ENABLE_HSTS`, and never sent on `local`.** There is no `preload`: joining the browser preload list is hard to undo and covers every subdomain for good, so it is an owner decision. Setting `ENABLE_HSTS=true` in Vercel production is also an owner step. Before that step, someone must confirm that every `*.vitalos.co.uk` host serves valid HTTPS (admin, mail and tracking hosts included), because `includeSubDomains` makes browsers refuse plain http on all of them for two years.
4. **Sources kept:** Turnstile (`https://challenges.cloudflare.com` in `script-src` and `frame-src`), the Relay realtime WebSocket (`wss://<project>.supabase.co`, ADR-038), the content media and CV upload hosts, and Vercel Analytics and Speed Insights, which are same-origin (`/_vercel/…`) and need no entry (ADR-046).
5. **Verified by tests:** unit tests on `buildCsp`, `buildSecurityHeaders` and the app's header config; `tests/end-to-end/protocol.http.spec.ts` on live responses; and `tests/accessibility/mobile.spec.ts`, which fails on any CSP violation in the console on every template.

## Final policy (production, Turnstile configured)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: <content media host>; font-src 'self'; connect-src 'self' <CV upload host> [<Relay realtime wss origin>]; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains   (when ENABLE_HSTS=true)
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: accelerometer=(), bluetooth=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), serial=(), usb=()
```

## Plan for `'unsafe-inline'`

Revisit when either of these happens: Next.js can emit hashes for its inline bootstrap and flight scripts in static output (watch the `experimental.sri` notes in the CSP guide), or the site gains a reason to render dynamically anyway. Until then the mitigations are those in ADR-020: React escaping, server-side validation, no third-party script origins, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and, from now on, `script-src-attr 'none'`.

## Consequences

- Clickjacking is refused twice. Inline-handler injection is blocked, but an injected inline `<script>` would still run, so React's escaping and the HTML sanitiser stay the first line of defence (`docs/security/threat-model.md`).
- An http-only subdomain would break for HSTS-capable browsers once `ENABLE_HSTS=true` is set with `includeSubDomains`. That is why switching it on stays a separate, checked step.
