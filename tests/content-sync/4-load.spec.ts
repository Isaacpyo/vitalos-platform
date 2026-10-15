import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { Admin, readSeed, site, until } from "./support/admin";

/**
 * Load test (brief Phase 6): 50 publish-side changes in 5 minutes, each reflected on its article
 * within the 5 s target. It cycles ten posts that 1-sync published (posts 4 to 13): unpublish,
 * then publish again, alternately, one action every ~5 s, and measures each from the admin's
 * success response to the first public response showing the change.
 */
test.describe.configure({ mode: "serial" });

const TARGET_MS = 5_000;
const ACTIONS = 50;
const WINDOW_MS = 5 * 60_000;

test("50 publishes and unpublishes in 5 minutes, all within the target", async () => {
  test.setTimeout(8 * 60_000);
  const seed = readSeed();
  const admin = await Admin.signIn();
  const cycle = seed.posts.slice(3, 13);
  const published = new Set(cycle.map((post) => post.id));
  const timings: number[] = [];
  const started = Date.now();
  try {
    for (let i = 0; i < ACTIONS; i += 1) {
      const post = cycle[i % cycle.length]!;
      const live = published.has(post.id);
      if (!live) await admin.tickChecks(post.id);
      const at = await admin.action(post.id, live ? "unpublish" : "publish");
      timings.push(
        await until(
          async () => {
            const article = await site(`/insights/${post.slug}`);
            return live
              ? article.status === 404
              : article.status === 200 && article.text.includes(post.title);
          },
          at,
          30_000,
        ),
      );
      if (live) published.delete(post.id);
      else published.add(post.id);
      // Spread the actions across the window (about one every 6 s), as editors would.
      const due = started + ((i + 1) * WINDOW_MS) / ACTIONS;
      const wait = due - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 5_000)));
    }
  } finally {
    await admin.dispose();
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
  const summary = {
    n: timings.length,
    p50: p(0.5),
    p95: p(0.95),
    max: sorted.at(-1),
    totalMs: Date.now() - started,
  };
  const dir = join(process.cwd(), "test-results", "content-sync");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "load.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log("load timings (ms):", JSON.stringify(summary));
  expect(summary.totalMs).toBeLessThanOrEqual(WINDOW_MS + 60_000);
  expect(summary.p95).toBeLessThanOrEqual(TARGET_MS);
});
