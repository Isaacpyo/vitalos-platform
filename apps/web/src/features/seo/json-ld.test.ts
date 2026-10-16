import { describe, expect, it } from "vitest";
import type { InsightView, JobView, PersonView } from "@vitalos/cms";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  jobPostingJsonLd,
  organizationJsonLd,
  profilePageJsonLd,
  serializeJsonLd,
  webSiteJsonLd,
} from "./json-ld";

const ctx = { siteUrl: "https://www.example.invalid" };

describe("organizationJsonLd", () => {
  it("fabricates nothing from empty site settings: brand facts only", () => {
    const node = organizationJsonLd({}, ctx);
    expect(node).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "https://www.example.invalid/#organization",
      name: "Vitalos",
      url: "https://www.example.invalid/",
      // The approved symbol, the locked proposition and the market from the About copy.
      logo: {
        "@type": "ImageObject",
        url: "https://www.example.invalid/brand/vitalos-symbol-512.png",
        width: 512,
        height: 512,
      },
      description:
        "We help ambitious organisations modernise operations, build digital products and adopt AI.",
      areaServed: { "@type": "Country", name: "United Kingdom" },
    });
    expect(node["knowsAbout"]).toContain("Software engineering");
    for (const invented of [
      "identifier",
      "sameAs",
      "address",
      "email",
      "legalName",
      "telephone",
      "foundingDate",
    ]) {
      expect(node).not.toHaveProperty(invented);
    }
  });

  it("adds only the fields the settings have", () => {
    const node = organizationJsonLd(
      {
        legalName: "Example Legal Name Ltd",
        contactEmail: "hello@example.invalid",
        registeredAddress: "1 Example Street, Example Town",
        social: [
          { label: "LinkedIn", href: "https://www.linkedin.com/company/example" },
          { label: "Bad", href: "javascript:alert(1)" },
        ],
        logo: { src: "/images/logo.svg", width: 120, height: 32 },
        companyNumber: "00000000",
      },
      ctx,
    );
    expect(node).toMatchObject({
      legalName: "Example Legal Name Ltd",
      identifier: {
        "@type": "PropertyValue",
        propertyID: "Companies House company number",
        value: "00000000",
      },
      email: "hello@example.invalid",
      sameAs: ["https://www.linkedin.com/company/example"],
      logo: { "@type": "ImageObject", url: "https://www.example.invalid/images/logo.svg" },
    });
    expect(node).not.toHaveProperty("address");
  });

  it("skips a logo that is neither same-site nor https, and blank values", () => {
    const node = organizationJsonLd(
      {
        legalName: "  ",
        logo: { src: "http://insecure.invalid/logo.svg", width: 1, height: 1 },
        social: [],
      },
      ctx,
    );
    expect(node).not.toHaveProperty("logo");
    expect(node).not.toHaveProperty("identifier");
    expect(node).not.toHaveProperty("legalName");
    expect(node).not.toHaveProperty("sameAs");
  });
});

describe("webSiteJsonLd", () => {
  it("has no search action or invented fields", () => {
    const node = webSiteJsonLd(ctx);
    expect(node["@type"]).toBe("WebSite");
    expect(node).not.toHaveProperty("potentialAction");
    expect(node.url).toBe("https://www.example.invalid/");
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers items and uses absolute URLs", () => {
    const node = breadcrumbJsonLd(
      [
        { name: "Home", path: "/" },
        { name: "What We Do", path: "/what-we-do" },
        { name: "Consulting", path: "/what-we-do/consulting" },
      ],
      ctx,
    );
    expect(node?.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.example.invalid/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "What We Do",
        item: "https://www.example.invalid/what-we-do",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Consulting",
        item: "https://www.example.invalid/what-we-do/consulting",
      },
    ]);
  });

  it("is null for a trail that is not a trail", () => {
    expect(breadcrumbJsonLd([{ name: "Home", path: "/" }], ctx)).toBeNull();
    expect(breadcrumbJsonLd([], ctx)).toBeNull();
    expect(
      breadcrumbJsonLd(
        [
          { name: "", path: "/a" },
          { name: "B", path: "/b" },
        ],
        ctx,
      ),
    ).toBeNull();
  });
});

const insight = (overrides: Partial<InsightView> = {}): InsightView => ({
  id: "i1",
  slug: "example-insight",
  title: "Example insight (fixture)",
  seo: {},
  format: "article",
  topics: [],
  authors: [{ id: "p1", slug: "example-person", title: "Example Person (fixture)" }],
  publishedAt: "2026-03-01T09:00:00Z",
  body: [],
  related: [],
  ...overrides,
});

describe("articleJsonLd", () => {
  it("describes an article with a named author and a published date", () => {
    const node = articleJsonLd(
      insight({ updatedAt: "2026-03-05T09:00:00Z", summary: "A summary." }),
      ctx,
    );
    expect(node).toMatchObject({
      "@type": "Article",
      headline: "Example insight (fixture)",
      description: "A summary.",
      datePublished: "2026-03-01T09:00:00Z",
      dateModified: "2026-03-05T09:00:00Z",
      author: [
        {
          "@type": "Person",
          name: "Example Person (fixture)",
          url: "https://www.example.invalid/people/example-person",
        },
      ],
    });
    expect(node).not.toHaveProperty("image");
  });

  it("is null for placeholder content, even with a named author and a valid date", () => {
    expect(articleJsonLd(insight({ placeholder: true }), ctx)).toBeNull();
  });

  it("is null without a named author or a valid date", () => {
    expect(articleJsonLd(insight({ authors: [] }), ctx)).toBeNull();
    expect(
      articleJsonLd(insight({ authors: [{ id: "p", slug: "s", title: "" }] }), ctx),
    ).toBeNull();
    expect(articleJsonLd(insight({ publishedAt: "not a date" }), ctx)).toBeNull();
  });
});

describe("profilePageJsonLd", () => {
  const person = (overrides: Partial<PersonView> = {}): PersonView => ({
    id: "p1",
    slug: "example-person",
    title: "Example Person (fixture)",
    name: "Example Person (fixture)",
    seo: {},
    isLeadership: false,
    credentials: [],
    sameAs: [],
    insights: [],
    ...overrides,
  });

  it("is null for a placeholder persona (no Person, no ProfilePage)", () => {
    expect(profilePageJsonLd(person({ placeholder: true }), ctx)).toBeNull();
  });

  it("includes only present fields", () => {
    const node = profilePageJsonLd(person(), ctx)!;
    expect(node["@type"]).toBe("ProfilePage");
    const entity = node.mainEntity as Record<string, unknown>;
    expect(entity).toMatchObject({ "@type": "Person", name: "Example Person (fixture)" });
    for (const invented of ["jobTitle", "image", "sameAs", "description"]) {
      expect(entity).not.toHaveProperty(invented);
    }
  });

  it("uses role, portrait and verified https links when present", () => {
    const node = profilePageJsonLd(
      person({
        role: "Example role",
        portrait: {
          url: "/images/portrait.jpg",
          alt: "Portrait",
          width: 400,
          height: 400,
        },
        sameAs: ["https://www.linkedin.com/in/example", "http://insecure.invalid"],
      }),
      ctx,
    )!;
    expect(node.mainEntity).toMatchObject({
      jobTitle: "Example role",
      sameAs: ["https://www.linkedin.com/in/example"],
      image: { url: "https://www.example.invalid/images/portrait.jpg" },
    });
  });
});

describe("jobPostingJsonLd", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const job = (overrides: Partial<JobView> = {}): JobView => ({
    id: "j1",
    slug: "example-role",
    title: "Example role (fixture)",
    seo: {},
    status: "open",
    datePosted: "2026-05-01",
    location: "Example Town",
    employmentType: "Full-time",
    description: [
      {
        _type: "block",
        children: [{ _type: "span", text: "Role description.", marks: [] }],
        markDefs: [],
      },
    ],
    ...overrides,
  });

  it("is null for a placeholder role, even when open with a description and location", () => {
    expect(jobPostingJsonLd(job({ placeholder: true }), ctx, now)).toBeNull();
  });

  it("describes an open role with no invented salary or remote claims", () => {
    const node = jobPostingJsonLd(job({ validThrough: "2026-07-01" }), ctx, now);
    expect(node).toMatchObject({
      "@type": "JobPosting",
      title: "Example role (fixture)",
      description: "Role description.",
      datePosted: "2026-05-01",
      validThrough: "2026-07-01",
      employmentType: "FULL_TIME",
      jobLocation: { "@type": "Place", address: "Example Town" },
    });
    for (const invented of [
      "baseSalary",
      "jobLocationType",
      "directApply",
      "applicantLocationRequirements",
    ]) {
      expect(node).not.toHaveProperty(invented);
    }
  });

  it("is null for closed, expired, undescribed or locationless roles", () => {
    expect(jobPostingJsonLd(job({ status: "closed" }), ctx, now)).toBeNull();
    expect(jobPostingJsonLd(job({ validThrough: "2026-05-15" }), ctx, now)).toBeNull();
    expect(jobPostingJsonLd(job({ description: [] }), ctx, now)).toBeNull();
    const noDescription = { ...job(), description: undefined } as unknown as JobView;
    expect(jobPostingJsonLd(noDescription, ctx, now)).toBeNull();
    expect(jobPostingJsonLd(job({ datePosted: "never" }), ctx, now)).toBeNull();
    const noLocation = { ...job(), location: undefined } as unknown as JobView;
    expect(jobPostingJsonLd(noLocation, ctx, now)).toBeNull();
  });

  it("omits an employment type it cannot map", () => {
    expect(
      jobPostingJsonLd(job({ employmentType: "Portfolio career" }), ctx, now),
    ).not.toHaveProperty("employmentType");
  });
});

describe("serializeJsonLd", () => {
  it("escapes < and line separators", () => {
    const text = serializeJsonLd({ a: "</script>  " });
    expect(text).not.toContain("<");
    expect(text).not.toContain(" ");
    expect(text).not.toContain(" ");
    expect(JSON.parse(text)).toEqual({ a: "</script>  " });
  });
});
