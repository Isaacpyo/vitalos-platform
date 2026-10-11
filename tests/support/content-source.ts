/**
 * Which content source the server under test was built with (playwright.config.ts passes
 * E2E_CONTENT_SOURCE through as VITALOS_CONTENT_SOURCE; default `fixtures`).
 *
 * Most end-to-end specs assert the artificial fixture documents ("Example Practice (fixture)",
 * slugs such as `example-offer`) and the `full` set's open gates. Under the `draft` source
 * (ADR-025, the `e2e-draft` CI job) those documents do not exist, so such specs skip themselves
 * with `test.skip(isDraftRun, FIXTURE_SPECIFIC)` and the reason below. Cross-cutting sweeps
 * (axe, reflow, focus, sitemap, crawl) run against the draft templates instead.
 */
export const contentSourceUnderTest = process.env.E2E_CONTENT_SOURCE ?? "fixtures";

export const isDraftRun = contentSourceUnderTest === "draft";

export const FIXTURE_SPECIFIC =
  "fixture-specific: asserts the artificial fixture documents or the full set's open gates, which the draft content source does not have";
