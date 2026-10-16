import { describe, expect, it } from "vitest";
import type { PersonView } from "@vitalos/cms";
import {
  breadcrumbJsonLd,
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

describe("serializeJsonLd", () => {
  it("escapes < and line separators", () => {
    const text = serializeJsonLd({ a: "</script>  " });
    expect(text).not.toContain("<");
    expect(text).not.toContain(" ");
    expect(text).not.toContain(" ");
    expect(JSON.parse(text)).toEqual({ a: "</script>  " });
  });
});
