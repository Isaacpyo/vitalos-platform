import { describe, expect, it } from "vitest";
import { describeContentSourceContract } from "../content/testing/contract";
import {
  createRepoContentSource,
  dropPlaceholders,
  repoContent,
  repoPreviewContent,
  withoutUnpublished,
} from "./index";

const NOW = () => new Date("2026-10-12T12:00:00Z");
const source = () => createRepoContentSource({ now: NOW });

describeContentSourceContract("Repo content", source);

/** Legal pages approved for the repo source. Adding one is a deliberate change to this list. */
const approvedLegalSlugs = ["privacy", "candidate-privacy", "cookies", "terms", "accessibility"];

/** Text that must never be published: placeholders, draft marks, invented-content markers. */
const FORBIDDEN =
  /\[[^\]]+\]|\bDRAFT\b|\bTODO\b|[Ll]orem|[Pp]ending approval|[Nn]ot in force|[Pp]laceholder|Illustrative scenario|to be confirmed/;

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      // Rich-text bookkeeping keys, not visible copy.
      if (key === "_key" || key === "_type" || key === "style") continue;
      strings(item, out);
    }
  }
  return out;
}

describe("repo content hygiene", () => {
  it("serves no placeholder, draft mark or bracketed text anywhere", () => {
    const hits = strings(repoContent).filter((text) => FORBIDDEN.test(text));
    expect(hits).toEqual([]);
  });

  it("contains no invented people, insights, case studies or roles", async () => {
    const s = source();
    for (const kind of ["person", "insight", "caseStudy", "job"] as const) {
      expect(await s.listSummaries(kind), kind).toEqual([]);
    }
    const chrome = await s.getSiteChrome();
    expect(chrome.gates.open).toMatchObject({ work: false, insights: false, careers: false });
    expect(chrome.gates.counts).toMatchObject({ work: 0, insights: 0, careers: 0 });
  });

  it("serves only the approved legal pages, never the draft skeletons", async () => {
    const s = source();
    const slugs = (await s.listSummaries("legalPage")).map((page) => page.slug);
    expect(slugs).toEqual(approvedLegalSlugs);
    for (const slug of ["acceptable-use"] as const) {
      expect(await s.getDocument("legalPage", slug), slug).toBeNull();
    }
  });

  it("publishes cookies, terms and accessibility from approved text, never the draft skeletons", async () => {
    for (const slug of ["cookies", "terms", "accessibility", "candidate-privacy"] as const) {
      const page = await source().getDocument("legalPage", slug);
      expect(page?.title, slug).not.toContain("DRAFT");
      // No bracketed placeholder in any text span.
      expect(JSON.stringify(page?.body), slug).not.toMatch(/"text":"[^"]*\[[^\]"]+\]/);
      expect(page?.seo.noindex, slug).not.toBe(true);
    }
  });

  it("publishes the approved privacy notice as an indexable, versioned page", async () => {
    const privacy = await source().getDocument("legalPage", "privacy");
    expect(privacy).toMatchObject({
      title: "Privacy notice",
      version: "2026-10-analytics",
      effectiveDate: "2026-10-16",
    });
    expect(privacy?.seo.noindex).not.toBe(true);
    const headings = privacy?.body.filter((block) => block.style === "h2") ?? [];
    expect(headings).toHaveLength(10); // includes Relay (15 Oct 2026) and website analytics (16 Oct 2026)
  });

  it("carries the owner-published company facts and nothing invented beside them", async () => {
    const { settings } = await source().getSiteChrome();
    expect(settings).toMatchObject({
      legalName: "Vitalos Technologies Limited",
      companyNumber: "16696895",
      registeredAddress: "114 High Street, Bentley, Doncaster, England, DN5 0AT",
      contactEmail: "support@vitalos.co.uk",
    });
    expect(settings.logo).toBeUndefined();
    expect(settings.social).toEqual([
      { label: "LinkedIn", href: "https://www.linkedin.com/company/vitalos" },
      { label: "X", href: "https://x.com/vitalos" },
    ]);
    expect(settings.securityEmail).toBeUndefined();
  });

  it("serves the five practices and keeps the section index pages indexable", async () => {
    const s = source();
    expect(await s.listSummaries("practice")).toHaveLength(5);
    expect((await s.getRoutePage("work"))?.seo.noindex).not.toBe(true);
  });
});

describe("dropPlaceholders", () => {
  const block = (style: string, text: string) => ({
    _type: "block",
    _key: text,
    style,
    children: [{ _type: "span", _key: `${text}-s`, text, marks: [] }],
    markDefs: [],
  });

  it("drops bracketed blocks and the heading left empty above them", () => {
    const result = dropPlaceholders([
      block("h2", "Kept"),
      block("normal", "Real text."),
      block("h2", "Contact"),
      block("normal", "Contact: [to be confirmed]."),
    ]);
    expect(result.map((b) => b._key)).toEqual(["Kept", "Real text."]);
  });
});

describe("unpublished documents (Website Build Pack, 25 Oct 2026)", () => {
  const statusesIn = (value: unknown, out: string[] = []): string[] => {
    if (Array.isArray(value)) value.forEach((item) => statusesIn(item, out));
    else if (typeof value === "object" && value !== null) {
      for (const [key, item] of Object.entries(value)) {
        if (key === "publishStatus" && typeof item === "string") out.push(item);
        else statusesIn(item, out);
      }
    }
    return out;
  };

  it("production holds nothing unpublished, at any depth", () => {
    expect(statusesIn(repoContent).filter((status) => status !== "published")).toEqual([]);
  });

  it("serves the approved Health & Care lead page and offers in production (26 Oct 2026)", async () => {
    const production = source();
    const industry = await production.getDocument("industry", "health-care");
    expect(industry?.landing?.publishStatus).toBe("published");
    expect(industry?.landing?.seo.noindex).not.toBe(true);
    const sitemap = (await production.getSitemapEntries()).map((entry) => entry.path);
    for (const slug of [
      "clinic-admin-audit",
      "nhs-assurance-readiness",
      "medical-logistics-digitisation",
    ]) {
      const offer = await production.getDocument("offer", slug);
      expect(offer?.publishStatus, slug).toBe("published");
      expect(offer?.work ?? [], slug).toEqual([]);
      expect(sitemap, slug).toContain(`/offers/${slug}`);
    }
  });

  it("previews hold the drafts, unindexed, and production lists none of them", async () => {
    const preview = createRepoContentSource({ now: NOW, includeUnpublished: true });
    const production = source();
    for (const kind of ["offer", "caseStudy"] as const) {
      const drafts = repoPreviewContent.documents[kind].filter(
        (doc) => doc.publishStatus !== undefined && doc.publishStatus !== "published",
      );
      for (const doc of drafts) {
        expect(doc.seo.noindex, doc.slug).toBe(true);
        expect(await preview.getDocument(kind, doc.slug), doc.slug).not.toBeNull();
        expect(await production.getDocument(kind, doc.slug), doc.slug).toBeNull();
      }
    }
    const sitemap = (await preview.getSitemapEntries()).map((entry) => entry.path);
    for (const doc of repoPreviewContent.documents.offer) {
      if (doc.publishStatus === "draft") expect(sitemap).not.toContain(`/offers/${doc.slug}`);
    }
  });

  it("drops unpublished list members and fields, and keeps everything else", () => {
    const value = {
      title: "Kept",
      landing: { publishStatus: "draft", heading: "Dropped" },
      offers: [
        { slug: "live" },
        { slug: "published", publishStatus: "published" },
        { slug: "approved", publishStatus: "approved" },
      ],
      nested: { items: [{ slug: "draft", publishStatus: "draft" }] },
    };
    expect(withoutUnpublished(value)).toEqual({
      title: "Kept",
      offers: [{ slug: "live" }, { slug: "published", publishStatus: "published" }],
      nested: { items: [] },
    });
  });
});
