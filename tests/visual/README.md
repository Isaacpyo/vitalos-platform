# Visual regression (non-gating)

Full-page Playwright `toHaveScreenshot` baselines for the 26 page templates in `tests/support/routes.ts`, at 1440 and 390 CSS px, under the `full` fixture set. Decision 7 of ADR-021; status note at the end of that ADR.

**Status: non-gating.** It is not part of `pnpm check` or `pnpm test:e2e`, and the CI job `visual` is `continue-on-error: true` and must not be a required check. It becomes a gate only after the owner approves the Figma templates (ADR-021), by a later ADR amendment.

## Commands

```sh
pnpm test:visual          # compare against the baselines for this environment
pnpm test:visual:update   # (re)write the local baselines
```

Both build and start `apps/web` through the e2e config's web server. `E2E_PORT` and `E2E_SKIP_BUILD=1` behave as in `playwright.config.ts`.

## Where baselines live

`tests/visual/__screenshots__/{platform}-{set}/{project}/{template}.png`

- `set` is `VISUAL_BASELINE_SET` (default `local`; CI sets `ci`).
- `linux-local/` is generated with `pnpm test:visual:update` in your own environment and is git-ignored: it is never committed, and CI never reads it. A local baseline from one machine will not match another.
- `linux-ci/` is the set CI compares against. It does not exist until the owner adopts one (below).

## Determinism

Reduced motion and `animations: "disabled"`; `document.fonts.ready` and `waitForSettledLayout` awaited; one scroll pass so lazy images load; horizontal scrollers (carousels) reset to the start; the Turnstile iframe and any `<time>` element masked; fixed viewports, device scale factor 1, UTC, `en-GB`; `maxDiffPixelRatio: 0.005` to tolerate anti-aliasing.

## Adopting CI baselines (owner steps)

1. Open the first CI run of the `visual` job (it passes or fails softly; either is fine) and download the artifact `visual-baselines-for-adoption`. It contains the `desktop-1440/` and `mobile-390/` folders.
2. Unzip into `tests/visual/__screenshots__/linux-ci/` so that, for example, `tests/visual/__screenshots__/linux-ci/desktop-1440/home.png` exists.
3. Review the images (they are the first look at the templates as CI renders them), commit and push.

From then on the job compares against them and, on any difference, uploads `visual-diff-report` (HTML report, actual, expected and diff images). To accept an intended change, delete the stale `linux-ci` images (or the whole folder), let the job record new ones, and adopt them the same way. A runner image or Chromium upgrade can shift anti-aliasing; re-adopt in that case rather than loosening the threshold.

## When it becomes a gate

Only after the owner approves the Figma templates (ADR-021 decision 7). At that point: adopt a fresh `linux-ci` set from approved templates, amend ADR-021, remove `continue-on-error` and add the job to the required checks. Until then a red `visual` job means "look", not "block".
