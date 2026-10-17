import { expect, test } from "@playwright/test";

/**
 * Site-wide metadata over HTTP (17 Oct 2026 review, WS5): web manifest and icons (C8), RSS
 * autodiscovery (C9), sitemap lastmod on the top-level pages (C7), and the initial HTML of the
 * homepage without a Relay panel (C2, fixed by WS6).
 */

test.describe("manifest, theme colour and icons (C8)", () => {
  test("manifest.webmanifest names the site and lists icons that exist", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/manifest+json");
    const manifest = (await response.json()) as {
      name: string;
      start_url: string;
      theme_color: string;
      icons: { src: string }[];
    };
    expect(manifest.name).toBe("Vitalos");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toMatch(/^#[0-9A-F]{6}$/i);
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    }
  });

  test("the home page links the manifest and sets a theme colour", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"/);
    expect(html).toMatch(/<meta name="theme-color" content="#[0-9A-Fa-f]{6}"/);
  });

  for (const path of ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"]) {
    test(`${path} serves the Apple touch icon`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
    });
  }
});

test.describe("RSS autodiscovery (C9)", () => {
  for (const path of ["/", "/what-we-do", "/contact", "/faq", "/this-page-does-not-exist"]) {
    test(`${path} advertises the Insights feed`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      const link =
        html.match(/<link rel="alternate" type="application\/rss\+xml"[^>]*>/)?.[0] ?? "";
      expect(link).toContain('title="Vitalos Insights"');
      expect(link).toMatch(/href="[^"]*\/insights\/feed\.xml"/);
    });
  }
});

test("top-level pages carry a lastmod in the sitemap (C7)", async ({ request }) => {
  const xml = await (await request.get("/sitemaps/pages.xml")).text();
  const entries = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)];
  // The homepage and the one-segment pages (indexes, About, Contact, FAQ): no document date of
  // their own, so they take the repo copy's git date.
  const topLevel = entries.filter(([, loc]) => /^\/[^/]*$/.test(new URL(loc!).pathname));
  expect(topLevel.length).toBeGreaterThan(0);
  const undated = topLevel.filter(([, , lastmod]) => !lastmod).map(([, loc]) => loc);
  expect(undated, "sitemap URLs without lastmod").toEqual([]);
  for (const [, loc, lastmod] of topLevel) {
    expect(Number.isNaN(Date.parse(lastmod!)), `${loc} lastmod ${lastmod}`).toBe(false);
  }
});

test("C2 (fixed by WS6): the homepage's initial HTML has no Relay panel or Relay article", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  expect(html).not.toContain('id="relay-panel"');
  // The page itself has no <article> on the homepage; any article would be Relay's transcript.
  const relayRoot = html.indexOf("relay-root");
  if (relayRoot >= 0) {
    expect(html.slice(relayRoot)).not.toMatch(/<article[\s>]/);
    expect(html.slice(relayRoot)).not.toContain('role="log"');
  }
});
