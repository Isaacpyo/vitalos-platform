# ADR 020 Security headers, Content-Security-Policy and non-production noindex

Status: Accepted.

## Context

The public vercel.app preview shell shipped with no indexing control, so search engines could index a non-production build. Stage 10 §6 and §24 require preview and staging to be non-indexable and ask for tested CSP, HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options and frame controls "appropriate to the final integrations", warning against an over-restrictive template that breaks Sanity preview. Stage 0 §24 and §26 require secure headers, a documented CSP approach, HSTS at the correct layer after domain validation, PII redaction in logs and correlation ids. Next.js 16 renames middleware to `proxy.ts`, and nonce-based CSP forces every page to render dynamically.

## Decision

1. **Headers are built by pure functions and composed in `next.config.ts`.** `@vitalos/security/headers` (`buildSecurityHeaders`) and `@vitalos/security/csp` (`buildCsp`) build strings from explicit inputs and read no environment. `apps/web/src/config/security-headers.ts` decides the inputs per deploy env from `@vitalos/config/build` and returns one rule for `/:path*`, so the headers also cover static assets, API routes and not-found responses and are unit-testable without a server.

2. **Non-production is never indexable.** `X-Robots-Tag: noindex, nofollow` is sent on every response whenever `deployEnv !== "production"`. The test is inverted deliberately: only the literal `production` is indexable, so an unknown or mistyped env fails closed. `robots.txt` and metadata (workstream G1) are a second layer, not a replacement.

3. **Baseline headers on every response:** `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and a `Permissions-Policy` that denies accelerometer, bluetooth, browsing-topics, camera, geolocation, gyroscope, magnetometer, microphone, payment, serial and usb.

4. **HSTS only behind `ENABLE_HSTS`.** `Strict-Transport-Security: max-age=31536000` is emitted only when the flag is true and never for the `local` env. No `includeSubDomains` and no `preload`: both are effectively irreversible and are separate decisions for the owner after the canonical host and DNS are validated (plan section 6). Vercel may also apply HSTS on its own domains.

5. **CSP is header-based with `'unsafe-inline'` for scripts.** Shipped enforced policy (production, no Turnstile):

   ```
   default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.sanity.io; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
   ```

   Variations, all decided in `security-headers.ts`:
   - `'unsafe-eval'` in `script-src` only under `next dev` (React debugging).
   - Turnstile on (both keys configured): `https://challenges.cloudflare.com` added to `script-src` and `frame-src`.
   - Outside production only: `connect-src` gains `https://<project>.api.sanity.io`, `https://<project>.apicdn.sanity.io` and `wss://<project>.api.sanity.io` for draft/preview and visual editing; `frame-ancestors` is `SANITY_STUDIO_ORIGIN` (Studio Presentation frames the site) when set. Production keeps `'none'` and no client-side Sanity connections.
   - `upgrade-insecure-requests` everywhere except `local` (plain-http runs).
   - Origins and project ids are validated against strict patterns and the build throws on anything else, so an environment value cannot inject a CSP directive.

   `style-src 'unsafe-inline'` is required by styled-components (a web dependency used by next-sanity tooling) and React style attributes.

6. **No per-request nonce.** A nonce needs a dynamic render for every page, which removes static rendering, CDN caching and Partial Prerendering for a content site whose pages are static by design (ADR-018 will cover rendering and caching).

7. **Experimental SRI spike (Next 16.4.0, `experimental.sri.algorithm: "sha256"`).** Built the shell with SRI enabled and loaded it in Chromium against a strict policy (`script-src 'self'`, no `'unsafe-inline'`). Findings:
   - SRI adds `integrity` attributes to the external chunk scripts only. Static rendering is unaffected.
   - Three inline scripts remain in every prerendered page (the Turbopack runtime bootstrap `<script id="_R_">` and the `self.__next_f.push(...)` flight-data scripts). All three were reported as CSP violations. Their content differs per page and per build, so a static header cannot carry their hashes.
   - Conclusion: SRI does not remove the need for `'unsafe-inline'`. A strict `Content-Security-Policy-Report-Only` would report on every page load with no actionable signal (and there is no report endpoint yet), so it is **not shipped**. `buildCsp({ variant: "strict" })` and `buildSecurityHeaders({ cspReportOnly })` exist and are tested so the policy can be switched on without redesign. Revisit when Next supports hash-based CSP for inline scripts, or when a dynamic-rendering requirement makes nonces acceptable.

8. **Correlation lives in `proxy.ts`.** `apps/web/proxy.ts` keeps a well-formed inbound `x-request-id` (`^[A-Za-z0-9._-]{8,128}$`) or generates a UUID, forwards it to the app and echoes it on the response. Security headers are deliberately not set in the proxy.

9. **Observability and redaction.** `@vitalos/observability` provides a structured JSON logger (timestamp, severity, service, env, event, correlationId), an `ErrorReporter` interface with a console implementation, and request-id helpers. All attributes pass through `@vitalos/security/redact`, which masks credential keys and personal-data keys (email, phone, any key ending in name, message or goal, body, payload, comments, notes, details, company, client IP keys and forwarding headers such as x-forwarded-for), truncates every string to 8 KB before any regular expression runs (linear patterns, no ReDoS), and scrubs email addresses and bearer credentials inside strings. The logger never throws (bigint, invalid dates, throwing getters and failing sinks fall back to a fixed line), replaces `SyntaxError` messages (which quote input) with a generic message, logs stack frames without the message line, and requires `event` to be a static literal. `apps/web/instrumentation.ts` reports server errors through the reporter with the query string stripped from the path. A Sentry adapter is blocked on the owner's DSN (plan section 6) and will implement the same interface.

10. **Analytics contract only.** `apps/web/src/features/analytics` fixes the Stage 10 §22 event taxonomy as a closed, schema-validated list with non-personal properties (slugs, route, enumerated outcome) and provides a no-op and a logger sink. No third-party script or network call exists until the owner chooses a provider and consent approach.

## Options

- Nonce-based CSP via `proxy.ts`: rejected, forces dynamic rendering of every page (decision 6).
- Experimental SRI as the route to a strict CSP: rejected after the spike (decision 7).
- Setting headers in `proxy.ts`: rejected, it would skip static assets and need a running server to test.
- Allowing `https://vercel.live` in preview: not done. **Accepted:** the Vercel preview toolbar (comments, feedback, draft controls) is blocked by this CSP on preview deployments; this is cosmetic and avoids widening the policy. Revisit if reviewers need the toolbar.
- `X-Frame-Options`: not sent. `frame-ancestors` supersedes it in every supported browser, and a fixed `DENY` would block the Studio Presentation frame outside production.

## Reasons

Fail-closed noindex protects the public preview immediately. Pure builders with explicit inputs make every per-environment rule testable. Keeping static rendering preserves performance and caching, and the SRI spike showed a stricter policy is not achievable yet without that cost.

## Trade-offs

`'unsafe-inline'` weakens XSS protection compared with a nonce or hash policy; mitigations are `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, no third-party script origins (apart from Turnstile when enabled), React's output escaping, and server-side input validation. The non-production policy is looser by design (Sanity API and Studio framing).

## Consequences

Any new third-party origin (analytics, fonts, embeds) must be added to `buildCsp` with a test and reviewed. Preview and staging responses carry noindex regardless of `robots.txt`. The `local` deploy env never emits HSTS or `upgrade-insecure-requests`.

## Revisit triggers

Next.js ships hash-based CSP for inline scripts; rendering moves to dynamic for another reason; an analytics or embed provider is chosen; the canonical host is validated (HSTS, `includeSubDomains`, preload); a CSP report endpoint exists; Studio is deployed on a final origin.
