import { expect, test } from "@playwright/test";
import { Admin, readSeed, revalidate, setReachable, site, until } from "./support/admin";
import { ADMIN_URL } from "./support/env.mjs";

/**
 * Availability drill (brief A4 and 13): with the admin unreachable the website stays up. Cached
 * pages are served, the homepage renders without the two sections, and a page with nothing cached
 * answers 503 with Retry-After rather than 404. When the admin is back, everything recovers
 * without a redeploy. Runs after 1-sync, which published and visited the Insights pages.
 */
test.describe.configure({ mode: "serial" });

test("admin down: cached pages served, homepage without the sections, uncached page 503", async () => {
  const seed = readSeed();
  const cached = seed.posts[3]!; // published and visited by 1-sync
  expect((await site(`/insights/${cached.slug}`)).status).toBe(200);
  // /insights/page/2 exists (20+ published posts) but no one has rendered it yet.
  await setReachable("admin", false);
  try {
    const article = await site(`/insights/${cached.slug}`);
    expect(article.status).toBe(200);
    expect(article.text).toContain(cached.title);

    const uncached = await site("/insights/page/2");
    expect(uncached.status).toBe(503);
    expect(uncached.headers.get("retry-after")).toBe("120");

    // Force the homepage to re-render while the admin is down (as a TTL expiry would).
    await revalidate("remove", ["home"], ["/"]);
    const home = await site("/");
    expect(home.status).toBe(200);
    expect(home.text).not.toContain("All insights");
  } finally {
    await setReachable("admin", true);
  }
});

test("admin back: the uncached page and the homepage sections recover without a redeploy", async () => {
  const admin = await Admin.signIn();
  try {
    // A failed read is never cached, so the next request after the proxy's short "unavailable"
    // memory (5 s) renders normally.
    await until(
      async () => (await site("/insights/page/2")).status === 200,
      Date.now(),
      30_000,
      1_000,
    );
    // The operator's "Resync everything" (or the TTL) refreshes the homepage.
    const page = await (await admin.api.get("/content/sync/")).text();
    const token = /name="csrfmiddlewaretoken" value="([^"]+)"/.exec(page)?.[1] ?? "";
    const response = await admin.api.post("/content/sync/resync/", {
      form: { csrfmiddlewaretoken: token },
      headers: { referer: `${ADMIN_URL}/content/sync/` },
      maxRedirects: 0,
    });
    expect(response.status()).toBeLessThan(400);
    await until(
      async () => (await site("/")).text.includes("All insights"),
      Date.now(),
      30_000,
      500,
    );
  } finally {
    await admin.dispose();
  }
});
