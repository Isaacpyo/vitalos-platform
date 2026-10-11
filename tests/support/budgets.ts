import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Client JavaScript budget helper (ADR-021). Budgets live in tests/performance/budgets.json and
 * are expressed in gzip bytes of every script the browser requests while loading a route
 * (framework chunks, route chunks and third-party scripts). Inline scripts are not counted.
 *
 * Two budgets per route: `maxJsGzipBytes` for scripts served from the site's own origin, and
 * `maxThirdPartyJsGzipBytes` (default 0) for scripts from any other origin. A third-party script
 * therefore cannot appear on a route unless the budget file says so, and its size, which the site
 * does not control and which changes without a deploy, never makes the first-party budget flaky.
 */

export interface RouteBudget {
  /** Maximum gzip bytes of same-origin JavaScript requested while loading the route. */
  maxJsGzipBytes: number;
  /** Maximum gzip bytes of JavaScript from other origins (for example Turnstile). Default 0. */
  maxThirdPartyJsGzipBytes?: number;
}

export interface BudgetFile {
  default: RouteBudget;
  routes: Record<string, RouteBudget>;
}

export interface ScriptMeasurement {
  url: string;
  gzipBytes: number;
  thirdParty: boolean;
}

export interface JsMeasurement {
  /** Same-origin plus third-party. */
  totalGzipBytes: number;
  firstPartyGzipBytes: number;
  thirdPartyGzipBytes: number;
  scripts: ScriptMeasurement[];
}

const BUDGET_PATH = resolve(__dirname, "../performance/budgets.json");

export function loadBudgets(path: string = BUDGET_PATH): BudgetFile {
  return JSON.parse(readFileSync(path, "utf8")) as BudgetFile;
}

export function budgetFor(route: string, budgets: BudgetFile = loadBudgets()): RouteBudget {
  return budgets.routes[route] ?? budgets.default;
}

/** Loads `route` in a clean navigation and sums the gzip size of every script response. */
export async function measureJs(page: Page, route: string): Promise<JsMeasurement> {
  const pending: Promise<{ url: string; gzipBytes: number } | null>[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() !== "script") return;
    pending.push(
      response
        .body()
        .then((body) => ({ url: response.url(), gzipBytes: gzipSync(body).length }))
        .catch(() => null),
    );
  });
  await page.goto(route, { waitUntil: "load" });
  // Let hydration chunks finish. "networkidle" alone is unreliable: link prefetches to routes
  // that do not exist yet can stay pending, so cap the wait instead of failing on it.
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
  const origin = new URL(page.url()).origin;
  const scripts = (await Promise.all(pending))
    .filter((entry): entry is { url: string; gzipBytes: number } => entry !== null)
    .map((entry) => ({ ...entry, thirdParty: new URL(entry.url).origin !== origin }));
  const sum = (list: ScriptMeasurement[]) => list.reduce((total, s) => total + s.gzipBytes, 0);
  const firstPartyGzipBytes = sum(scripts.filter((s) => !s.thirdParty));
  const thirdPartyGzipBytes = sum(scripts.filter((s) => s.thirdParty));
  return {
    totalGzipBytes: firstPartyGzipBytes + thirdPartyGzipBytes,
    firstPartyGzipBytes,
    thirdPartyGzipBytes,
    scripts,
  };
}

const largestOf = (scripts: ScriptMeasurement[]) =>
  [...scripts]
    .sort((a, b) => b.gzipBytes - a.gzipBytes)
    .slice(0, 5)
    .map((s) => `  ${s.gzipBytes} B  ${s.thirdParty ? "[third-party] " : ""}${s.url}`)
    .join("\n");

/** Fails when the route's JavaScript exceeds its budgets; the message lists the largest files. */
export async function expectWithinJsBudget(page: Page, route: string): Promise<JsMeasurement> {
  const measurement = await measureJs(page, route);
  const budget = budgetFor(route);
  const thirdPartyBudget = budget.maxThirdPartyJsGzipBytes ?? 0;
  expect(
    measurement.firstPartyGzipBytes,
    `First-party JS for ${route} is ${measurement.firstPartyGzipBytes} B gzip, budget ${budget.maxJsGzipBytes} B. Largest scripts:\n${largestOf(measurement.scripts)}`,
  ).toBeLessThanOrEqual(budget.maxJsGzipBytes);
  expect(
    measurement.thirdPartyGzipBytes,
    `Third-party JS for ${route} is ${measurement.thirdPartyGzipBytes} B gzip, budget ${thirdPartyBudget} B (default 0: no third-party script without an explicit budget). Largest scripts:\n${largestOf(measurement.scripts.filter((s) => s.thirdParty))}`,
  ).toBeLessThanOrEqual(thirdPartyBudget);
  return measurement;
}
