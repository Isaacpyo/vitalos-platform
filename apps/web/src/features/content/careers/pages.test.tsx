import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixtureContentSource } from "@vitalos/cms/fixtures";
import { ContentNotFoundError, ContentUnavailableError } from "../client";
import { createReaders } from "../readers";
import { validateJsonLd } from "../../seo/json-ld-rules";

/**
 * Route-level behaviour of the Careers pages against a fake admin (the contract fixtures):
 * closed or unconfigured is 404; open renders the page and roles; an empty list shows the
 * approved empty state; a closed role keeps its page without a form or JSON-LD and is noindex.
 */

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../../contracts/content-api/v1/fixtures/${name}.json`, import.meta.url),
      "utf8",
    ),
  );

const admin = vi.hoisted(() => ({
  configured: true,
  down: false,
  answers: {} as Record<string, unknown>,
}));

vi.mock("../server", () => ({
  getContentReaders: () =>
    createReaders({
      client: admin.configured
        ? ({
            get: async (path: string, schema: { parse(v: unknown): unknown }) => {
              if (admin.down) throw new ContentUnavailableError("network");
              const answer = admin.answers[path.split("?")[0] ?? ""];
              if (answer === undefined) throw new ContentNotFoundError();
              return schema.parse(answer);
            },
            post: vi.fn(),
          } as never)
        : null,
      cache: (fn) => fn,
      ttlSeconds: 600,
    }),
}));
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("../../../lib/cms/get-content-source", () => ({
  getContentSource: async () => createFixtureContentSource("full"),
}));
vi.mock("../../seo/context", () => ({
  getSeoContext: () => ({ siteUrl: "https://www.example.test", indexable: true }),
}));

/** The page's JSON-LD blocks checked against the site's rules (features/seo/json-ld-rules.ts). */

/** Removes markup until none is left (a single pass can leave tags behind; CodeQL). */
function stripTags(html: string): string {
  let text = html;
  for (let previous = ""; previous !== text;) {
    previous = text;
    text = text.replace(/<[^<>]*>/g, "");
  }
  return text;
}

function jsonLdIssues(markup: string, path: string): string[] {
  const origin = "https://www.example.test";
  const blocks = [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    (match) => JSON.parse(match[1] ?? "null") as unknown,
  );
  expect(blocks.length, "the page has structured data").toBeGreaterThan(0);
  const h1 = stripTags(/<h1[^>]*>(.*?)<\/h1>/s.exec(markup)?.[1] ?? "")
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
  return validateJsonLd(blocks, { origin, canonical: `${origin}${path}`, h1 });
}

const pages = {
  index: () => import("../../../../app/(site)/careers/page"),
  role: () => import("../../../../app/(site)/careers/[slug]/page"),
  filter: () => import("../../../../app/(site)/careers/filter/[dimension]/[value]/page"),
};

beforeAll(async () => {
  await Promise.all(Object.values(pages).map((load) => load()));
}, 120_000);

beforeEach(() => {
  admin.configured = true;
  admin.down = false;
  admin.answers = {
    "/api/content/v1/site-state": fixture("site-state"),
    "/api/content/v1/careers/page": fixture("careers-page"),
    "/api/content/v1/careers/roles/example-role-fixture": fixture("role-open"),
    "/api/content/v1/careers/roles/closed-role": fixture("role-closed"),
    "/api/content/v1/careers/roles/old-role": { redirect: "example-role-fixture" },
  };
});

const params = <T,>(value: T) => ({ params: Promise.resolve(value) });
const is404 = { digest: expect.stringContaining("404") };
const html = (node: unknown) => renderToStaticMarkup(node as React.ReactElement);

describe("Careers pages when open", () => {
  it("renders the hero, the grouped roles and the closing band (no values section)", async () => {
    const markup = html(await (await pages.index()).default());
    expect(jsonLdIssues(markup, "/careers")).toEqual([]);
    expect(markup).toContain("Build what you advise");
    expect(markup).toContain('href="#open-roles"');
    // The "How we work" values section was removed (owner direction, 17 Oct 2026).
    expect(markup).not.toContain('id="how-we-work"');
    expect(markup).not.toContain("Ownership");
    expect(markup).toContain("Engineering (1)");
    expect(markup).toContain('href="/careers/example-role-fixture"');
    expect(markup).toContain("ENGINEERING · SENIOR · HYBRID · EXAMPLE CITY · PERMANENT");
    expect(markup).toContain("£10,000–£20,000 a year");
    expect(markup).toContain("Closes 30 Nov 2026");
    expect(markup).toContain("Talk to Vitalos");
    // Six or fewer roles: no filters.
    expect(markup).not.toContain('aria-label="Filter roles"');
  });

  it("shows the empty state without the open-roles button, and the associates line only when set", async () => {
    admin.answers["/api/content/v1/careers/page"] = fixture("careers-page-empty");
    const markup = html(await (await pages.index()).default());
    expect(markup).toContain("There are no open roles right now.");
    expect(markup).not.toContain('href="#open-roles"');
    expect(markup).not.toContain("Introduce yourself");
    const withLine = structuredClone(fixture("careers-page-empty")) as {
      copy: { associatesLine: string | null };
    };
    withLine.copy.associatesLine = "Example associates line (fixture).";
    admin.answers["/api/content/v1/careers/page"] = withLine;
    const lined = html(await (await pages.index()).default());
    expect(lined).toContain("Example associates line (fixture).");
    expect(lined).toContain('href="/contact?intent=careers"');
  });

  it("renders an open role with facts, sections, the apply anchor, the form and JobPosting", async () => {
    const markup = html(
      await (await pages.role()).default(params({ slug: "example-role-fixture" })),
    );
    // The site's dark hero: the role is the single h1; no visible breadcrumb trail.
    expect(markup.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(markup).toContain("Example role (fixture)</h1>");
    expect(markup).not.toContain('aria-label="Breadcrumb"');
    expect(markup).toContain("About the role");
    expect(markup).toContain("What you&#x27;ll do");
    expect(markup).not.toContain("Nice to have");
    expect(markup).toContain('href="#apply"');
    expect(markup).toContain("Turn on JavaScript to upload your CV and apply.");
    expect(markup).toContain('"@type":"JobPosting"');
    expect(markup).toContain('"directApply":true');
    // One graph: WebPage, BreadcrumbList and JobPosting, valid under the site's JSON-LD rules.
    expect(jsonLdIssues(markup, "/careers/example-role-fixture")).toEqual([]);
  });

  it("does not offer the form while the privacy notice is not set", async () => {
    const role = structuredClone(fixture("role-open")) as { privacy: { noticeUrl: string | null } };
    role.privacy.noticeUrl = null;
    admin.answers["/api/content/v1/careers/roles/example-role-fixture"] = role;
    const markup = html(
      await (await pages.role()).default(params({ slug: "example-role-fixture" })),
    );
    expect(markup).toContain("Applications are not open yet.");
    expect(markup).not.toContain("Turn on JavaScript to upload your CV and apply.");
  });

  it("keeps a closed role's page: notice, link to open roles, noindex, no form, no JSON-LD", async () => {
    const page = await pages.role();
    const markup = html(await page.default(params({ slug: "closed-role" })));
    expect(markup).toContain("CLOSED · 30 NOV 2026");
    expect(markup).toContain("This role closed on 30 November 2026.");
    expect(markup).toContain('href="/careers"');
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("application/ld+json");
    const metadata = await page.generateMetadata(params({ slug: "closed-role" }));
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("redirects an old slug and 404s unknown (paused, archived, draft) roles", async () => {
    const page = await pages.role();
    await expect(page.default(params({ slug: "old-role" }))).rejects.toMatchObject({
      digest: expect.stringContaining("/careers/example-role-fixture"),
    });
    await expect(page.default(params({ slug: "paused-role" }))).rejects.toMatchObject(is404);
  });

  it("serves filtered views only above six open roles", async () => {
    await expect(
      (await pages.filter()).default(params({ dimension: "practice", value: "engineering" })),
    ).rejects.toMatchObject(is404);
  });
});

describe("Careers pages when closed, unconfigured or down", () => {
  it.each([
    ["closed", () => (admin.answers["/api/content/v1/site-state"] = fixture("site-state-closed"))],
    ["not configured", () => (admin.configured = false)],
  ])("every page is 404 when %s", async (_label, arrange) => {
    arrange();
    await expect((await pages.index()).default()).rejects.toMatchObject(is404);
    await expect(
      (await pages.role()).default(params({ slug: "example-role-fixture" })),
    ).rejects.toMatchObject(is404);
  });

  it("throws at runtime when the admin is down (never cached)", async () => {
    admin.down = true;
    await expect((await pages.index()).default()).rejects.toBeInstanceOf(ContentUnavailableError);
  });
});
