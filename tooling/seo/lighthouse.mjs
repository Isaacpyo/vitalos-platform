#!/usr/bin/env node
// Lighthouse per template with budgets (`pnpm seo:check`, docs/seo/AUDIT.md). One URL stands for
// each template; budgets live in tooling/seo/budgets.json. Uses Playwright's Chromium, so no
// separate browser download is needed in CI.
//
//   node tooling/seo/lighthouse.mjs --origin http://127.0.0.1:3310 --out docs/seo/lighthouse/after.json [--assert]
//
// Lab scores only (mobile emulation, simulated throttling). Field data comes from Speed Insights.
// `is-crawlable` is skipped when the server is not the canonical host: a local run is noindexed
// by design and crawlability is checked by the production-mode crawl instead (seo-check.mjs).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

export async function runLighthouse({ origin, templates, skipCrawlable = true, runs = 1 }) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
  const results = [];
  try {
    for (const [template, urlPath] of Object.entries(templates)) {
      const samples = [];
      for (let i = 0; i < runs; i += 1) {
        const { lhr } = await lighthouse(
          new URL(urlPath, origin).toString(),
          {
            port,
            output: "json",
            logLevel: "error",
            onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
            ...(skipCrawlable ? { skipAudits: ["is-crawlable"] } : {}),
          },
          undefined,
        );
        samples.push(lhr);
      }
      // Median run by performance score.
      samples.sort(
        (a, b) => (a.categories.performance.score ?? 0) - (b.categories.performance.score ?? 0),
      );
      const lhr = samples[Math.floor(samples.length / 2)];
      const score = (key) => Math.round((lhr.categories[key]?.score ?? 0) * 100);
      const metric = (id) => lhr.audits[id]?.numericValue;
      results.push({
        template,
        path: urlPath,
        performance: score("performance"),
        accessibility: score("accessibility"),
        bestPractices: score("best-practices"),
        seo: score("seo"),
        lcpMs: Math.round(metric("largest-contentful-paint") ?? 0),
        cls: Number((metric("cumulative-layout-shift") ?? 0).toFixed(3)),
        tbtMs: Math.round(metric("total-blocking-time") ?? 0),
        fcpMs: Math.round(metric("first-contentful-paint") ?? 0),
        failedSeoAudits: Object.values(lhr.categories.seo.auditRefs)
          .map((ref) => lhr.audits[ref.id])
          .filter((a) => a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== "manual")
          .map((a) => a.id),
      });
    }
  } finally {
    await browser.close();
  }
  return results;
}

/** Budget failures, as readable lines. */
export function checkBudgets(results, budgets) {
  const failures = [];
  for (const r of results) {
    const b = { ...budgets.default, ...(budgets.templates?.[r.template] ?? {}) };
    if (r.seo < b.seo) failures.push(`${r.template} ${r.path}: SEO ${r.seo} < ${b.seo}`);
    if (r.performance < b.performance)
      failures.push(`${r.template} ${r.path}: performance ${r.performance} < ${b.performance}`);
    if (r.accessibility < b.accessibility)
      failures.push(
        `${r.template} ${r.path}: accessibility ${r.accessibility} < ${b.accessibility}`,
      );
    if (r.lcpMs > b.lcpMs)
      failures.push(`${r.template} ${r.path}: LCP ${r.lcpMs}ms > ${b.lcpMs}ms`);
    if (r.cls > b.cls) failures.push(`${r.template} ${r.path}: CLS ${r.cls} > ${b.cls}`);
    if (r.tbtMs > b.tbtMs)
      failures.push(`${r.template} ${r.path}: TBT ${r.tbtMs}ms > ${b.tbtMs}ms`);
  }
  return failures;
}

export async function readBudgets() {
  return JSON.parse(await readFile(path.join(here, "budgets.json"), "utf8"));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here, "lighthouse.mjs");
if (isMain) {
  const { values } = parseArgs({
    options: {
      origin: { type: "string" },
      out: { type: "string" },
      assert: { type: "boolean", default: false },
      crawlable: { type: "boolean", default: false },
      runs: { type: "string", default: "1" },
    },
  });
  const budgets = await readBudgets();
  const results = await runLighthouse({
    origin: values.origin,
    templates: budgets.urls,
    skipCrawlable: !values.crawlable,
    runs: Number(values.runs),
  });
  console.table(
    results.map(({ failedSeoAudits, ...r }) => ({ ...r, seoFails: failedSeoAudits.join(" ") })),
  );
  if (values.out) {
    await mkdir(path.dirname(values.out), { recursive: true });
    await writeFile(values.out, `${JSON.stringify({ origin: values.origin, results }, null, 2)}\n`);
  }
  if (values.assert) {
    const failures = checkBudgets(results, budgets);
    for (const f of failures) console.error(`budget: ${f}`);
    if (failures.length > 0) process.exit(1);
  }
}
