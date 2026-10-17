import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, organizationJsonLd, webSiteJsonLd } from "./json-ld";
import { homePageNode, jsonLdGraph, serviceNode, softwareNode, webPageNode } from "./graph";
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

describe("product page graph", () => {
  const path = "/products/example";
  const graph = () =>
    jsonLdGraph([
      webPageNode(
        {
          path,
          name: "Example",
          description: "Example sentence.",
          breadcrumb: true,
          aboutSoftware: true,
        },
        ctx,
      ),
      breadcrumbJsonLd(
        [
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
          { name: "Example", path },
        ],
        ctx,
      ),
      softwareNode(
        {
          path,
          name: "Example",
          description: "Example sentence.",
          url: "https://product.example.invalid",
          applicationCategory: "BusinessApplication",
        },
        ctx,
      ),
    ]);

  it("describes the product as a SoftwareApplication the page is about, published by Vitalos", () => {
    const nodes = (graph() as unknown as { "@graph": Record<string, unknown>[] })["@graph"];
    const software = nodes.find((node) => node["@type"] === "SoftwareApplication");
    expect(software).toEqual({
      "@type": "SoftwareApplication",
      "@id": `${origin}${path}#software`,
      name: "Example",
      description: "Example sentence.",
      url: "https://product.example.invalid",
      applicationCategory: "BusinessApplication",
      publisher: { "@id": `${origin}/#organization` },
      mainEntityOfPage: { "@id": `${origin}${path}#webpage` },
    });
    expect(nodes[0]?.["about"]).toEqual({ "@id": `${origin}${path}#software` });
    for (const invented of ["offers", "aggregateRating", "review"]) {
      expect(software).not.toHaveProperty(invented);
    }
  });

  it("passes the page rules: the product's own https site is its only off-origin URL", () => {
    expect(
      validateJsonLd([graph()], { origin, canonical: `${origin}${path}`, h1: "Example" }),
    ).toEqual([]);
    const insecure = jsonLdGraph([
      softwareNode(
        { path, name: "Example", url: "http://product.example.invalid", applicationCategory: "X" },
        ctx,
      ),
    ]);
    expect(validateJsonLd([insecure], { origin }).join(" ")).toMatch(/SoftwareApplication: url/);
  });
});
