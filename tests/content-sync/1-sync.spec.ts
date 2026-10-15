import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  Admin,
  adminTick,
  readSeed,
  setReachable,
  site,
  until,
  websiteTick,
  type Seed,
} from "./support/admin";
import { ADMIN_URL } from "./support/env.mjs";

/**
 * Sync suite (brief 3.1 and 13): changes made in the real Super Admin reach every affected public
 * page within 5 s at p95, measured from the admin's success response.
 */
test.describe.configure({ mode: "serial" });

const TARGET_MS = 5_000;
let admin: Admin;
let seed: Seed;
const timings: Record<string, number[]> = { publish: [], changes: [], unpublish: [] };

const post = (n: number) => {
  const value = seed.posts[n - 1];
  if (!value) throw new Error(`No seeded post ${n}`);
  return value;
};

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? NaN;
}

/** Every public surface a publish must reach (brief 3.1). */
async function visibleEverywhere(title: string, slug: string): Promise<boolean> {
  const [article, index, home, feed, author, topic] = await Promise.all([
    site(`/insights/${slug}`),
    site("/insights"),
    site("/"),
    site("/insights/feed.xml"),
    site(`/insights/authors/${seed.author}`),
    site(`/insights/topics/${seed.topic}`),
  ]);
  return (
    article.status === 200 &&
    article.text.includes(title) &&
    [index, home, feed, author, topic].every(
      (page) => page.status === 200 && page.text.includes(title),
    )
  );
}

test.beforeAll(async () => {
  seed = readSeed();
  admin = await Admin.signIn();
});

test.afterAll(async () => {
  const dir = join(process.cwd(), "test-results", "content-sync");
  mkdirSync(dir, { recursive: true });
  const summary = Object.fromEntries(
    Object.entries(timings)
      .filter(([, values]) => values.length > 0)
      .map(([name, values]) => [
        name,
        {
          n: values.length,
          p50: percentile(values, 50),
          p95: percentile(values, 95),
          max: Math.max(...values),
        },
      ]),
  );
  writeFileSync(join(dir, "timings.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log("sync timings (ms):", JSON.stringify(summary));
  await admin?.dispose();
});

test("20 publishes each reach the article, index, homepage, feed, author and topic pages", async () => {
  for (let n = 1; n <= 20; n += 1) {
    const { id, slug, title } = post(n);
    expect((await site(`/insights/${slug}`)).status).toBe(404);
    const at = await admin.action(id, "publish");
    timings.publish!.push(await until(() => visibleEverywhere(title, slug), at, 30_000));
  }
  expect(percentile(timings.publish!, 95)).toBeLessThanOrEqual(TARGET_MS);
});

test("publish changes: the new title appears everywhere; unpublished edits never do", async ({
  page,
}) => {
  // The newest post: it is on the homepage, page 1 of the index and page 1 of its topic.
  const { id, slug, title } = post(20);
  const renamed = "Example sync post 20 renamed (fixture)";
  await admin.editorPage(page, id);
  await page.getByLabel("Title", { exact: true }).fill(renamed);
  await page.getByLabel("Title", { exact: true }).blur();
  await expect(page.getByText(/^SAVED \d\d:\d\d$/)).toBeVisible();
  // The working copy changed; the public article must keep the published title.
  for (let i = 0; i < 10; i += 1) {
    const article = await site(`/insights/${slug}`);
    expect(article.text).toContain(title);
    expect(article.text).not.toContain(renamed);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await admin.tickChecks(id);
  const at = await admin.action(id, "publish");
  timings.changes!.push(await until(() => visibleEverywhere(renamed, slug), at, 30_000));
  expect(timings.changes![0]!).toBeLessThanOrEqual(TARGET_MS);
});

test("slug change: the old URL answers 308 to the new one", async ({ page }) => {
  const { id, slug, title } = post(2);
  const moved = `${slug}-moved`;
  await admin.editorPage(page, id);
  await page.getByLabel("Slug").fill(moved);
  await page.getByLabel("Slug").blur();
  await expect(page.getByText(/^SAVED \d\d:\d\d$/)).toBeVisible();
  await admin.tickChecks(id);
  const at = await admin.action(id, "publish");
  const elapsed = await until(
    async () => {
      const old = await site(`/insights/${slug}`);
      const current = await site(`/insights/${moved}`);
      return (
        old.status === 308 &&
        (old.headers.get("location") ?? "").endsWith(`/insights/${moved}`) &&
        current.status === 200 &&
        current.text.includes(title)
      );
    },
    at,
    30_000,
  );
  expect(elapsed).toBeLessThanOrEqual(TARGET_MS);
});

test("unpublish: 404, and gone from the homepage, feed and sitemap", async () => {
  // Among the newest three, so it is on the homepage before it is unpublished.
  const { id, slug, title } = post(19);
  expect((await site("/")).text).toContain(title);
  // Publish events warm the sitemap (stale-while-revalidate would otherwise serve the old one).
  await until(
    async () => (await site("/sitemap.xml")).text.includes(`/insights/${slug}<`),
    Date.now(),
    10_000,
  );
  const at = await admin.action(id, "unpublish");
  const elapsed = await until(
    async () => {
      const [article, home, feed, sitemap] = await Promise.all([
        site(`/insights/${slug}`),
        site("/"),
        site("/insights/feed.xml"),
        site("/sitemap.xml"),
      ]);
      return (
        article.status === 404 &&
        !home.text.includes(title) &&
        !feed.text.includes(title) &&
        !sitemap.text.includes(`/insights/${slug}<`)
      );
    },
    at,
    30_000,
  );
  timings.unpublish!.push(elapsed);
  expect(elapsed).toBeLessThanOrEqual(TARGET_MS);
});

test("schedule for about a minute ahead: live within 2 minutes, through the Worker's tick path", async () => {
  test.setTimeout(6 * 60_000);
  const { id, slug, title } = post(21);
  // The editor takes minutes (Europe/London). Pick the minute at least 70 s ahead.
  const due = new Date(Math.ceil((Date.now() + 70_000) / 60_000) * 60_000);
  const local = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(due)
    .replace(" ", "T");
  await admin.action(id, "schedule", { publish_at: local });
  // The Cloudflare Worker calls the website's tick route once a minute; the website calls the
  // admin only when its cached nextDueAt has passed (ADR-038). Simulate that cadence honestly.
  const worker = setInterval(() => void websiteTick().catch(() => undefined), 60_000);
  try {
    void websiteTick().catch(() => undefined);
    const elapsed = await until(
      async () => {
        const article = await site(`/insights/${slug}`);
        return article.status === 200 && article.text.includes(title);
      },
      due.getTime(),
      150_000,
      1_000,
    );
    timings.scheduled = [elapsed];
    expect(elapsed).toBeLessThanOrEqual(120_000);
  } finally {
    clearInterval(worker);
  }
});

test("website target down: pending, failed after 3 attempts, then retry once it is back", async () => {
  test.setTimeout(8 * 60_000);
  const { id } = post(22);
  const status = async () => (await admin.api.get(`/insights/posts/${id}/sync/`)).text();
  await setReachable("web", false);
  try {
    await admin.action(id, "publish");
    expect(await status()).toContain("SYNC PENDING");
    // Backoff is 1, then 2 minutes; the tick retries what is due (the Worker's job in production).
    await until(
      async () => {
        await adminTick();
        return (await status()).includes("SYNC FAILED");
      },
      Date.now(),
      6 * 60_000,
      15_000,
    );
  } finally {
    await setReachable("web", true);
  }
  const fragment = await status();
  const retry = /action="(\/content\/sync\/[0-9a-f-]{36}\/retry\/)"/.exec(fragment)?.[1];
  expect(retry, "the failed item offers Retry").toBeTruthy();
  const page = await (await admin.api.get("/content/sync/")).text();
  const token = /name="csrfmiddlewaretoken" value="([^"]+)"/.exec(page)?.[1] ?? "";
  const response = await admin.api.post(retry!, {
    form: { csrfmiddlewaretoken: token },
    headers: { referer: `${ADMIN_URL}/content/sync/` },
    maxRedirects: 0,
  });
  expect(response.status()).toBeLessThan(400);
  await until(async () => (await status()).includes("LIVE · SYNCED"), Date.now(), 30_000, 500);
});

test("preview shows the working copy while the public URL stays 404", async ({ page }) => {
  const { id, slug, title } = post(23);
  expect((await site(`/insights/${slug}`)).status).toBe(404);
  const preview = await admin.api.get(`/insights/posts/${id}/preview/site/`, { maxRedirects: 0 });
  const location = preview.headers()["location"] ?? "";
  expect(location).toContain("/api/content/preview?token=");
  await page.goto(location);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText(/PREVIEW · NOT PUBLISHED/)).toBeVisible();
  // The public cache is unaffected: a request without the preview cookies still gets 404.
  expect((await site(`/insights/${slug}`)).status).toBe(404);
  await page.getByRole("link", { name: "Exit preview" }).click();
  expect((await site(`/insights/${slug}`)).status).toBe(404);
});
