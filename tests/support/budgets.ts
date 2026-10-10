import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Client JavaScript budget helper (ADR-021). Budgets live in tests/performance/budgets.json and
 * are expressed in gzip bytes of every script the browser requests while loading a route
 * (framework chunks, route chunks and third-party scripts). Inline scripts are not counted.
 */

export interface RouteBudget {
  /** Maximum gzip bytes of JavaScript requested while loading the route. */
  maxJsGzipBytes: number;
}

export interface BudgetFile {
  default: RouteBudget;
  routes: Record<string, RouteBudget>;
}

export interface JsMeasurement {
  totalGzipBytes: number;
  scripts: { url: string; gzipBytes: number }[];
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
  const scripts = (await Promise.all(pending)).filter(
    (entry): entry is { url: string; gzipBytes: number } => entry !== null,
  );
  return { totalGzipBytes: scripts.reduce((sum, s) => sum + s.gzipBytes, 0), scripts };
}

/** Fails when the route's JavaScript exceeds its budget; the message lists the largest files. */
export async function expectWithinJsBudget(page: Page, route: string): Promise<JsMeasurement> {
  const measurement = await measureJs(page, route);
  const budget = budgetFor(route);
  const largest = [...measurement.scripts]
    .sort((a, b) => b.gzipBytes - a.gzipBytes)
    .slice(0, 5)
    .map((s) => `  ${s.gzipBytes} B  ${s.url}`)
    .join("\n");
  expect(
    measurement.totalGzipBytes,
    `JS for ${route} is ${measurement.totalGzipBytes} B gzip, budget ${budget.maxJsGzipBytes} B. Largest scripts:\n${largest}`,
  ).toBeLessThanOrEqual(budget.maxJsGzipBytes);
  return measurement;
}
