import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, organizationJsonLd, webSiteJsonLd } from "./json-ld";
import { homePageNode, jsonLdGraph, personNode, serviceNode, webPageNode } from "./graph";
import { validateJsonLd } from "./json-ld-rules";

const ctx = { siteUrl: "https://www.example.invalid" };
const origin = ctx.siteUrl;

const solutionGraph = () =>
  jsonLdGraph([
    webPageNode(
      {
        path: "/solutions/example",
        name: "Example Solution",
        description: "Example problem statement.",
        breadcrumb: true,
        aboutService: true,
        faq: [{ question: "Example question?", answer: "Example answer." }],
        dateModified: "2026-10-10",
      },
      ctx,
    ),
    breadcrumbJsonLd(
      [
        { name: "Home", path: "/" },
        { name: "Solutions", path: "/solutions" },
        { name: "Example Solution", path: "/solutions/example" },
      ],
      ctx,
    ),
    serviceNode(
      {
        path: "/solutions/example",
        name: "Example Solution",
        description: "Example problem statement.",
        serviceType: "Example Solution",
      },
      ctx,
    ),
  ]);

describe("page graph", () => {
  it("links WebPage, BreadcrumbList and Service by stable @ids", () => {
    const graph = solutionGraph() as unknown as { "@graph": Record<string, unknown>[] };
    const [page, crumbs, service] = graph["@graph"];
    expect(page).toMatchObject({
      "@type": ["WebPage", "FAQPage"],
      "@id": "https://www.example.invalid/solutions/example#webpage",
      isPartOf: { "@id": "https://www.example.invalid/#website" },
      breadcrumb: { "@id": "https://www.example.invalid/solutions/example#breadcrumb" },
      about: { "@id": "https://www.example.invalid/solutions/example#service" },
      inLanguage: "en-GB",
    });
    expect(crumbs).toMatchObject({
      "@id": "https://www.example.invalid/solutions/example#breadcrumb",
    });
    expect(service).toMatchObject({
      "@type": "Service",
      provider: { "@id": "https://www.example.invalid/#organization" },
      areaServed: { "@type": "Country", name: "United Kingdom" },
    });
    expect(service).not.toHaveProperty("offers");
    expect(JSON.stringify(graph)).not.toContain('@context":"https://schema.org","@type');
  });

  it("passes validation when it matches the page", () => {
    expect(
      validateJsonLd([solutionGraph()], {
        origin,
        canonical: "https://www.example.invalid/solutions/example",
        h1: "Example Solution",
        text: "Example Solution Example question? Example answer.",
      }),
    ).toEqual([]);
  });

  it("fails when the markup says more than the page", () => {
    const issues = validateJsonLd([solutionGraph()], {
      origin,
      canonical: "https://www.example.invalid/solutions/other",
      h1: "Another heading",
      text: "No questions here.",
    });
    expect(issues.join("\n")).toMatch(/not the canonical/);
    expect(issues.join("\n")).toMatch(/not the h1/);
    expect(issues.join("\n")).toMatch(/FAQ question not visible/);
  });

  it("validates the homepage graph and keeps out ratings, how-tos and search actions", () => {
    const home = jsonLdGraph([
      organizationJsonLd({ legalName: "Example Ltd", companyNumber: "00000000" }, ctx),
      webSiteJsonLd(ctx),
      homePageNode({ name: "Example heading.", description: "Example lead." }, ctx),
    ]);
    expect(
      validateJsonLd([home], { origin, canonical: `${origin}/`, h1: "Example heading." }),
    ).toEqual([]);
    const bad = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "AggregateRating", ratingValue: 5 },
        { "@type": "WebSite", name: "X", url: `${origin}/`, potentialAction: {} },
        {
          "@type": "WebPage",
          "@id": `${origin}/x#webpage`,
          url: `${origin}/x`,
          name: "X",
          isPartOf: { "@id": `${origin}/nope` },
        },
      ],
    };
    const issues = validateJsonLd([bad], { origin }).join("\n");
    expect(issues).toMatch(/AggregateRating is not allowed/);
    expect(issues).toMatch(/potentialAction/);
    expect(issues).toMatch(/does not resolve/);
  });

  it("rejects a missing @context, duplicate @ids and off-site URLs", () => {
    const node = {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      name: "X",
      url: "https://elsewhere.invalid/",
    };
    const issues = validateJsonLd([node, { ...node, "@context": "https://schema.org" }], {
      origin,
    }).join("\n");
    expect(issues).toMatch(/@context/);
    expect(issues).toMatch(/used 2 times/);
    expect(issues).toMatch(/not on https:\/\/www.example.invalid/);
  });
});

describe("index and profile nodes (C11)", () => {
  const crumbs = (path: string, name: string) =>
    breadcrumbJsonLd(
      [
        { name: "Home", path: "/" },
        { name, path },
      ],
      ctx,
    );

  it("gives a CollectionPage an ItemList of what it lists, and the rules accept it", () => {
    const graph = jsonLdGraph([
      webPageNode(
        {
          path: "/solutions",
          name: "Solutions",
          type: "CollectionPage",
          breadcrumb: true,
          items: [
            { name: "Example A", path: "/solutions/a" },
            { name: " ", path: "/solutions/blank" },
            { name: "Example B", path: "/solutions/b" },
          ],
        },
        ctx,
      ),
      crumbs("/solutions", "Solutions"),
    ]) as unknown as { "@graph": Record<string, unknown>[] };
    expect(graph["@graph"][0]!["mainEntity"]).toEqual({
      "@type": "ItemList",
      numberOfItems: 2,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Example A",
          url: "https://www.example.invalid/solutions/a",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Example B",
          url: "https://www.example.invalid/solutions/b",
        },
      ],
    });
    expect(validateJsonLd([graph], { origin, h1: "Solutions" })).toEqual([]);
  });

  it("an empty index has no ItemList", () => {
    const node = webPageNode({ path: "/offers", name: "Offers", items: [] }, ctx);
    expect(node).not.toHaveProperty("mainEntity");
  });

  it("describes an author as a Person who works for the Organization", () => {
    const person = personNode(
      {
        name: "Example Author",
        path: "/insights/authors/example-author",
        jobTitle: "Founder",
        sameAs: ["https://www.linkedin.com/in/example", "javascript:alert(1)"],
      },
      ctx,
    );
    expect(person).toEqual({
      "@type": "Person",
      "@id": "https://www.example.invalid/insights/authors/example-author#person",
      name: "Example Author",
      url: "https://www.example.invalid/insights/authors/example-author",
      jobTitle: "Founder",
      worksFor: { "@id": "https://www.example.invalid/#organization" },
      sameAs: ["https://www.linkedin.com/in/example"],
    });
    const graph = jsonLdGraph([
      webPageNode(
        {
          path: "/insights/authors/example-author",
          name: "Example Author",
          type: "ProfilePage",
          breadcrumb: true,
          mainEntity: person,
        },
        ctx,
      ),
      crumbs("/insights/authors/example-author", "Example Author"),
    ]);
    expect(validateJsonLd([graph], { origin, h1: "Example Author" })).toEqual([]);
  });

  it("rejects an ItemList whose items are not on the site", () => {
    const bad = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "X", url: "https://elsewhere.invalid/x" },
      ],
    };
    expect(validateJsonLd([bad], { origin }).join("
")).toContain("is not on");
  });
});
