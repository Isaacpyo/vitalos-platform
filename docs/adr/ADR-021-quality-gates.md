# ADR 021 Quality gates, test harness and budgets

Status: Accepted.

## Context

Stage 0 §32–33, Stage 10 §26–29 and Stage 9 §34 require WCAG 2.2 AA, performance budgets, end-to-end journeys, security checks and CI gates before release. The baseline had one `quality` CI job (format, lint, typecheck, unit tests, boundaries, build, Storybook build), a Playwright config that ran `next dev`, and two smoke specs. Stage 1 is built by parallel workstreams, so the harness must run without Sanity, Supabase or any secret, and must switch to richer fixtures as the other workstreams land.

## Decision

1. **Browser suites run against a production build.** `playwright.config.ts` starts `next build && next start` for `apps/web` on `127.0.0.1:3210` (override with `E2E_PORT`), never `next dev`. The server environment is explicit: `VITALOS_DEPLOY_ENV=local`, `VITALOS_CONTENT_SOURCE=fixtures`, `VITALOS_FIXTURE_SET=full`, `VITALOS_ENQUIRY_BACKEND=memory`, Cloudflare's documented always-pass Turnstile test keys (site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`) and obviously test-only salt and dispatch secret. `@vitalos/config` rejects fixtures and the memory backend in production, so this environment cannot be promoted by accident. `E2E_CONTENT_SOURCE`, `E2E_FIXTURE_SET` and `E2E_ENQUIRY_BACKEND` switch the values (for example to `empty`) without editing the config. The fixtures source (C2) and memory backend (D) are separate workstreams; until they are wired in, the variables pass config validation and the app renders its locked-copy shell.

2. **Projects.** `chromium` (desktop) and `mobile` (390px) run every spec; `no-js` (JavaScript disabled) runs only `*.nojs.spec.ts`; `sparse` runs only `*.sparse.spec.ts` and is inert unless `E2E_SPARSE_BASE_URL` points at a server started with `VITALOS_FIXTURE_SET=sparse`. Gated routes are decided at build time, so a sparse server needs its own build; F2 wires that once the fixture source and gated routes exist.

3. **Shared helpers in `tests/support`.** `axe.ts` (`expectNoA11yViolations`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; readable failure output; retries when Storybook's own axe run is in flight), `overflow.ts` (`expectNoHorizontalOverflowAt320`, WCAG SC 1.4.10, reports the offending elements), `budgets.ts` (JS budget measurement and assertion) and `static-server.mjs` (dependency-free static server for the Storybook build).

4. **Storybook accessibility.** `pnpm test:storybook-a11y` serves `apps/storybook/storybook-static` and runs axe against every story in `index.json` (`tests/storybook/playwright.config.ts`, separate from the app config so it needs no app build). Stories render fragments, so the page-level rules `region`, `landmark-one-main` and `page-has-heading-one` are disabled for them; they are asserted on real templates by the page suites.

5. **JavaScript budgets.** `tests/performance/budgets.json` holds a maximum in gzip bytes of every script requested while loading a route (framework, route chunks, third-party; inline scripts excluded), with a `default` for routes without an entry. `pnpm test:perf` measures every route listed under `routes` on the desktop project. Baseline measured on the interim shell (`/`, Next 16.4.0 Turbopack, React 19.3.0): **138,630 B gzip**. Budgets carry about 15% headroom: `/` 160,000 B and a default of 175,000 B for templates not yet measured. Rules: a template's budget is set from its first measured build plus roughly 15%; a PR that raises a budget states why in its description and the owner reviews it; budgets are never raised to absorb an unexplained regression. The spec principle (Stage 9 §31, Stage 10 §27) is minimal client JavaScript on content pages, so budgets only ratchet down as the framework baseline shrinks. Lab Core Web Vitals (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1) stay advisory in CI and are measured in the field after launch; Lighthouse is not added in Stage 1.

6. **Client bundle secret scan.** `tooling/scripts/check-client-bundle-secrets.mjs` (`pnpm check:bundle-secrets`) scans `apps/web/.next/static` for any server-only environment variable name (every `@vitalos/config` schema key that is not `NEXT_PUBLIC_*`, read from the schema so new secrets are covered automatically) and for secret-shaped values (private keys, Stripe, Supabase, Sanity, AWS and GitHub tokens, JWTs, bearer credentials). Findings are reported by file and label, never by value. It refuses to pass when it scans no files. Unit tests live in `tests/integration`.

7. **Scripts.** `test:e2e`, `test:a11y`, `test:perf`, `test:storybook-a11y`, `check:bundle-secrets`, `db:test` (`supabase test db`, local stack only) and `check:raw-colours` (the script is delivered by workstream A and is intentionally not part of `check` yet; wire it into `check` once it lands).

8. **CI jobs.** `quality` is unchanged. `e2e` installs Chromium, then runs end-to-end, accessibility, performance budgets, the bundle secret scan and the integration tests, and uploads the Playwright report. `storybook-a11y` builds Storybook and runs the per-story axe suite. `database` starts a local Supabase stack with `supabase/setup-cli` (database and API containers only) and runs `supabase test db`; it holds no access token, project reference or database password and never links or pushes to a remote project. `NEXT_PUBLIC_SITE_URL` is set for every build. Action majors follow the repository (`checkout@v5`, `setup-node@v5`, `pnpm/action-setup@v4`).

9. **Visual regression is deferred.** Stage 10 §28 lists it; Stage 1 documents the decision rather than adding a screenshot service or baselines before templates stabilise. Revisit when G2a/G2b templates are approved.

## Options

- Run suites against `next dev`: rejected; it hides production-only behaviour (headers, static generation, bundle contents) and is slower and flakier.
- Jest/`http-server`/Lighthouse CI dependencies: rejected for Stage 1; Playwright and Node already cover static serving, per-story axe and script weight without new dependencies or lockfile churn.
- One shared Playwright config for Storybook and the app: rejected; it would force an app build to test Storybook.
- Budget in raw bytes of the `.next` output: rejected; it measures what ships, not what a visitor downloads on a route.

## Reasons

Gates must be reproducible without secrets and must fail loudly on the properties the specs name: accessibility, reflow, script weight, secret exposure and database access rules. Deriving the secret names from the config schema removes a manual list that would drift.

## Trade-offs

- Gzip is computed on the response body in the test, so it approximates, not equals, the CDN's Brotli transfer size; the number is stable and comparable, which is what a budget needs.
- `networkidle` is capped at three seconds because prefetches of routes that do not exist yet can stay pending; late-loading chunks beyond that would be missed.
- The `database` job pins no Supabase CLI version (`latest`); a CLI change can break CI independently of the repository. Pin it if that becomes a problem.
- The 320px reflow check currently expects a failure on the interim shell header (see Consequences).

## Consequences

- `tests/accessibility/baseline.spec.ts` marks the 320px homepage check `test.fail`: the interim shell header overflows at 320px (about 422px wide). It stays green while the defect exists and turns red when workstream B/G2a replaces the header, at which point the annotation must be removed so the check becomes a permanent gate.
- Further specs (journeys, per-template axe, abuse tests, gated and ungated routes, security headers) belong to F2; the contact-form spec belongs to H.
- Releases need the `e2e`, `storybook-a11y` and `database` jobs green in addition to `quality`.

## Revisit triggers

Templates stabilise (add visual regression); Lighthouse or field data shows a budget that the JS number misses; the Supabase CLI pin is needed; a sparse-fixture server becomes practical (single build with runtime-selected content); Vercel preview checks are introduced.

## Status update (10 Oct 2026)

Facts in this ADR that changed after it was accepted; the decisions are unchanged.

- Decision 7: `check:raw-colours` is now part of the root `check` script.
- Decision 8 and trade-offs: the `database` job pins the Supabase CLI to 2.120.0 (PR #26). The `quality` job also runs `check:cms-types` (generated Sanity types must not drift).
- Consequences: the 320px homepage check no longer carries `test.fail`; the interim shell was replaced and `tests/accessibility/baseline.spec.ts` now asserts reflow as a permanent gate.
- Decision 1: the fixtures content source and the memory enquiry backend are wired in (C2, D), so the e2e suites run against real fixture pages rather than the locked-copy shell.
- Decision 5: the JS budgets were re-measured with the G2a templates; `tests/performance/budgets.json` records the measured values and its own rationale (for example `/` is now measured at 145,287 B gzip with a 160,000 B budget). Routes without an entry still use the 175,000 B default.
- Workstream F2 (further journeys and suites, listed under Consequences) had not landed when this note was written.
