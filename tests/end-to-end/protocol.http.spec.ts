import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * HTTP-level behaviour of the production build (ADR-018, ADR-020, ADR-021): redirects, retired
 * paths, the 404 page, crawler policy and response headers. Runs in the `http` project (no
 * browser, once per run) against the `full` fixture set with VITALOS_DEPLOY_ENV=local, so every
 * non-production rule applies. Production-only behaviour (indexable robots.txt, no X-Robots-Tag,
 * HSTS) is unit-tested next to the code (seo.test.ts, headers.test.ts, security-headers.test.ts)
 * because no e2e server may run as production.
 */

const noFollow = { maxRedirects: 0 } as const;

test.describe("redirects (seed map, ADR-018)", () => {
  const seeded = [
    ["/services", "/what-we-do"],
    ["/technologies", "/labs"],
    ["/privacy", "/legal/privacy"],
    ["/terms", "/legal/terms"],
  ] as const;

  for (const [source, destination] of seeded) {
    test(`${source} answers 301 to ${destination}, which is not itself a redirect`, async ({
      request,
    }) => {
      const response = await request.get(source, noFollow);
      expect(response.status()).toBe(301);
      expect(new URL(response.headers()["location"] ?? "", "http://x").pathname).toBe(destination);
      // One hop only: the destination must be a live page.
      expect((await request.get(destination, noFollow)).status()).toBe(200);
    });
  }

  test("a redirect never depends on the HTTP method used by a crawler", async ({ request }) => {
    const response = await request.head("/services", noFollow);
    expect(response.status()).toBe(301);
  });
});

test.describe("retired paths answer 410 Gone (ADR-018)", () => {
  // The redirect map has no 410 rules until the owner approves some (plan section 6), so this
  // reads whatever is approved and published to apps/web/src/features/redirects/generated.ts and
  // asserts each one end to end. The proxy mechanism itself is unit-tested in proxy.gone.test.ts
  // with a stubbed rule. With no rules the loop is empty and the assertions below still hold.
  const generated = readFileSync(
    resolve(__dirname, "../../apps/web/src/features/redirects/generated.ts"),
    "utf8",
  );
  const gone = [...generated.matchAll(/source:\s*"([^"]+)"[^}]*status:\s*410/g)].map(
    (match) => match[1] as string,
  );

  for (const source of gone) {
    test(`${source} is 410 with no redirect`, async ({ request }) => {
      const response = await request.get(source, noFollow);
      expect(response.status()).toBe(410);
      expect(response.headers()["location"]).toBeUndefined();
    });
  }

  test("an unknown path is a 404 (never 410) and no seed redirect source is gone", async ({
    request,
  }) => {
    expect((await request.get("/never-existed", noFollow)).status()).toBe(404);
    for (const source of ["/services", "/technologies", "/privacy", "/terms"]) {
      expect((await request.get(source, noFollow)).status()).not.toBe(410);
    }
  });
});

test.describe("404 page", () => {
  test("unknown URLs answer 404 with the not-found page, not a soft 200", async ({ request }) => {
    // Unmatched URLs are answered by the root not-found, which carries the site header and footer
    // in the server-rendered HTML.
    for (const path of ["/this-page-does-not-exist", "/a/b/c/d"]) {
      const response = await request.get(path, noFollow);
      expect(response.status(), path).toBe(404);
      const html = await response.text();
      expect(html, path).toContain("Page not found");
      // Next.js marks 404s noindex in the document as well as in the header.
      expect(html, path).toMatch(/<meta name="robots" content="noindex/);
      expect(html, `${path} has the site header`).toMatch(/<header[\s>]/);
      expect(html, `${path} has the site footer`).toMatch(/<footer[\s>]/);
      expect(html.match(/<main[\s>]/g) ?? [], `${path} has one main landmark`).toHaveLength(1);
    }
    // A missing document on a dynamic route (unknown slug, lab type, lab asset, legal page): same
    // status and noindex. The proxy rewrites these onto an unmatched path (ADR-027), so the 404
    // content is in the server HTML; not-found.nojs.spec.ts asserts it for every route family.
    for (const path of [
      "/what-we-do/no-such-practice",
      "/labs/not-a-lab-type",
      "/labs/research/no-such-asset",
      "/legal/no-such-page",
    ]) {
      const response = await request.get(path, noFollow);
      expect(response.status(), path).toBe(404);
      const html = await response.text();
      expect(html, path).toContain("Page not found");
      expect(html, path).toMatch(/<meta name="robots" content="noindex/);
    }
  });

  test("an unknown API route is a 404 without an HTML page", async ({ request }) => {
    const response = await request.get("/api/does-not-exist", noFollow);
    expect(response.status()).toBe(404);
  });
});

test.describe("crawler policy outside production (ADR-020)", () => {
  test("robots.txt disallows everything and advertises no sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    const lines = (await response.text())
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    expect(lines.map((line) => line.toLowerCase())).toContain("user-agent: *");
    expect(lines).toContain("Disallow: /");
    expect(lines.filter((line) => /^allow:/i.test(line))).toEqual([]);
    expect(lines.filter((line) => /^sitemap:/i.test(line))).toEqual([]);
  });

  const everywhere = [
    "/",
    "/what-we-do/example-practice",
    "/contact",
    "/this-page-does-not-exist",
    "/robots.txt",
    "/sitemap.xml",
    "/api/health",
  ];
  // Redirect responses (for example /services) come from next.config redirects, which run before
  // header rules, so they carry no X-Robots-Tag. They have no body to index and their targets are
  // noindex, so this is not a gap.
  for (const path of everywhere) {
    test(`X-Robots-Tag: noindex, nofollow is set on ${path}`, async ({ request }) => {
      const response = await request.get(path, noFollow);
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    });
  }

  test("X-Robots-Tag also covers static assets", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const asset = /\/_next\/static\/[^"')\s]+\.css/.exec(html)?.[0];
    expect(asset, "a stylesheet URL in the home page").toBeDefined();
    const response = await request.get(asset as string);
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });
});

test.describe("security headers (ADR-020)", () => {
  const paths = ["/", "/contact", "/work", "/this-page-does-not-exist", "/api/health"];

  for (const path of paths) {
    test(`${path} carries CSP, nosniff, referrer-policy and permissions-policy`, async ({
      request,
    }) => {
      const headers = (await request.get(path, noFollow)).headers();
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      const permissions = headers["permissions-policy"] ?? "";
      for (const feature of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) {
        expect(permissions, `${path} permissions-policy`).toContain(feature);
      }
      expect(headers["x-powered-by"]).toBeUndefined();

      const csp = headers["content-security-policy"] ?? "";
      expect(csp, `${path} content-security-policy`).not.toBe("");
      const directives = new Map(
        csp.split(";").map((part) => {
          const [name = "", ...values] = part.trim().split(/\s+/);
          return [name, values] as const;
        }),
      );
      expect(directives.get("default-src")).toEqual(["'self'"]);
      expect(directives.get("object-src")).toEqual(["'none'"]);
      expect(directives.get("base-uri")).toEqual(["'self'"]);
      expect(directives.get("form-action")).toEqual(["'self'"]);
      // Nothing may frame the site.
      expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
      // Production build: React's dev tooling needs no eval.
      expect(directives.get("script-src") ?? []).not.toContain("'unsafe-eval'");
      // Turnstile is configured (test keys), so its origin is allowed and nothing else is.
      expect(directives.get("script-src")).toContain("https://challenges.cloudflare.com");
      expect(directives.get("frame-src")).toEqual(["https://challenges.cloudflare.com"]);
      // Plain-http local runs must not be upgraded; HSTS is opt-in and never sent locally.
      expect(csp).not.toContain("upgrade-insecure-requests");
      expect(headers["strict-transport-security"]).toBeUndefined();
    });
  }
});

test.describe("response hygiene", () => {
  test("every response echoes a well-formed correlation id; a good inbound id is kept", async ({
    request,
  }) => {
    const minted = await request.get("/");
    expect(minted.headers()["x-request-id"]).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    const kept = await request.get("/", { headers: { "x-request-id": "e2e-correlation-1234" } });
    expect(kept.headers()["x-request-id"]).toBe("e2e-correlation-1234");
    const replaced = await request.get("/", { headers: { "x-request-id": "bad id with spaces" } });
    expect(replaced.headers()["x-request-id"]).not.toContain(" ");
  });
});
