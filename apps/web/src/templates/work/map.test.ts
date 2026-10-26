import { describe, expect, it } from "vitest";
import { evaluateGates } from "@vitalos/cms";
import type { CaseStudyView } from "@vitalos/cms";
import { fullFixtureSet } from "@vitalos/cms/fixtures";
import {
  caseStudyFacts,
  caseStudyRowProps,
  isPublicCaseStudy,
  isVerifiedProof,
  namedClient,
  publishableTestimonial,
  relatedLinks,
  verifiedMetrics,
  workFilterGroups,
} from "./map";

const [named, anonymised, pending] = fullFixtureSet.documents.caseStudy as [
  CaseStudyView,
  CaseStudyView,
  CaseStudyView,
];

const withMetric = (study: CaseStudyView, evidence: "verified" | "pending" | "n/a") =>
  ({
    ...study,
    metrics: study.metrics.map((metric) => ({ ...metric, evidence: { status: evidence } })),
  }) as CaseStudyView;

describe("proof rules", () => {
  it("treats only verified evidence as public proof", () => {
    expect(isVerifiedProof(named)).toBe(true);
    expect(isVerifiedProof(pending)).toBe(false);
  });

  it("names the client only when display is named and a name exists", () => {
    expect(namedClient(named)).toBe(named.clientName);
    expect(namedClient(anonymised)).toBeUndefined();
    // An anonymised study never shows a name, even if the view carries one.
    expect(namedClient({ ...anonymised, clientName: "Leaked Client" })).toBeUndefined();
    // A "named" study without a name is treated as anonymised.
    expect(namedClient({ ...named, clientName: "  " })).toBeUndefined();
  });

  it("labels the client row 'Anonymised' for anonymised studies and never shows the name", () => {
    const facts = caseStudyFacts({ ...anonymised, clientName: "Leaked Client" });
    const client = facts.find((fact) => fact.label === "Client");
    expect(client?.value).toBe("Anonymised");
    expect(JSON.stringify(facts)).not.toContain("Leaked Client");
  });

  it("states the engagement basis", () => {
    const basis = (study: CaseStudyView) =>
      caseStudyFacts(study).find((fact) => fact.label === "Engagement")?.value;
    expect(basis(named)).toBe("Contracted by Vitalos");
    expect(basis(anonymised)).toBe("Prior founder / team experience");
  });
});

describe("metrics", () => {
  it("keeps sourced, verified metrics", () => {
    const metrics = verifiedMetrics(named);
    expect(metrics).toHaveLength(1);
    expect(metrics?.[0]?.source).not.toBe("");
  });

  it("drops metrics whose evidence is not verified", () => {
    expect(verifiedMetrics(withMetric(named, "pending"))).toBeUndefined();
    expect(verifiedMetrics(withMetric(named, "n/a"))).toBeUndefined();
  });

  it("drops metrics without evidence or without a source", () => {
    const metric = named.metrics[0]!;
    const noEvidence = { ...named, metrics: [{ ...metric, evidence: undefined }] };
    expect(verifiedMetrics(noEvidence as unknown as CaseStudyView)).toBeUndefined();
    expect(verifiedMetrics({ ...named, metrics: [{ ...metric, source: " " }] })).toBeUndefined();
  });

  it("shows no metrics for a case study that is not verified", () => {
    expect(verifiedMetrics({ ...named, evidence: { status: "pending" } })).toBeUndefined();
  });
});

describe("testimonial", () => {
  it("is shown for a named client with verified evidence", () => {
    expect(publishableTestimonial(named)?.attribution).toBe(named.testimonial?.attribution);
  });

  it("is withheld for an anonymised client (an attributed quote would identify it)", () => {
    const quote = { quote: "A quote", attribution: "A person" };
    expect(publishableTestimonial({ ...anonymised, testimonial: quote })).toBeUndefined();
  });

  it("is withheld without verified evidence or without an attribution", () => {
    expect(publishableTestimonial({ ...named, evidence: { status: "pending" } })).toBeUndefined();
    expect(
      publishableTestimonial({
        ...named,
        testimonial: { quote: "A quote", attribution: " " },
      }),
    ).toBeUndefined();
  });
});

describe("row props and filters", () => {
  it("links the row to the canonical case study page", () => {
    expect(caseStudyRowProps(named).href).toBe(`/work/${named.slug}`);
  });

  it("builds a filter only when a dimension can partition the list", () => {
    expect(workFilterGroups([named, { ...named, id: "copy" }])).toEqual([]);
    const other = { ...anonymised, practices: [{ id: "p2", slug: "other", title: "Other" }] };
    const groups = workFilterGroups([named, other]);
    expect(groups.map((group) => group.key)).toContain("practice");
    const practice = groups.find((group) => group.key === "practice");
    expect(practice?.options.map((option) => option.value).sort()).toEqual([
      "example-practice",
      "other",
    ]);
  });
});

describe("related links", () => {
  it("links practices and solutions, and industries only while their section is public", () => {
    const closed = relatedLinks(named, evaluateGates({}));
    expect(closed.some((link) => link.href.startsWith("/industries/"))).toBe(false);
    expect(closed.some((link) => link.href.startsWith("/what-we-do/"))).toBe(true);
    expect(closed.some((link) => link.href.startsWith("/solutions/"))).toBe(true);
    const open = relatedLinks(named, evaluateGates({ industries: 1 }));
    expect(open.some((link) => link.href.startsWith("/industries/"))).toBe(true);
  });
});

/** A copy of `value` without `key` (exact optional property types refuse `key: undefined`). */
function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy: Partial<T> = { ...value };
  delete copy[key];
  return copy as Omit<T, K>;
}

describe("Website Build Pack proof rules (Part 3)", () => {
  it("names a client only with a recorded written permission", () => {
    expect(namedClient(without(named, "clientPermission"))).toBeUndefined();
    expect(namedClient({ ...named, clientPermission: " " })).toBeUndefined();
    expect(namedClient(named)).toBe(named.clientName);
  });

  it("drops a metric without a verifier", () => {
    const metric = named.metrics[0]!;
    expect(verifiedMetrics({ ...named, metrics: [without(metric, "verifiedBy")] })).toBeUndefined();
    expect(verifiedMetrics({ ...named, metrics: [{ ...metric, verifiedBy: " " }] })).toBe(
      undefined,
    );
  });

  it("withholds a quote without a permission date", () => {
    const testimonial = without(named.testimonial!, "permissionDate");
    expect(publishableTestimonial({ ...named, testimonial })).toBeUndefined();
  });

  it("labels a product story 'Built and run by Vitalos' and shows no client", () => {
    const product: CaseStudyView = {
      ...anonymised,
      kind: "product",
      engagementBasis: "vitalos-product",
    };
    const facts = caseStudyFacts(product);
    expect(facts.find((fact) => fact.label === "Client")).toBeUndefined();
    expect(facts.find((fact) => fact.label === "Engagement")?.value).toBe(
      "Built and run by Vitalos",
    );
  });

  it("gives an unpublished draft a page (previews only serve drafts), but not pending proof", () => {
    expect(isPublicCaseStudy({ ...pending, publishStatus: "draft" })).toBe(true);
    expect(isPublicCaseStudy(pending)).toBe(false);
  });

  it("links the products and offers a case study names", () => {
    const links = relatedLinks(
      {
        ...anonymised,
        products: ["fauward", "not-a-product"],
        offers: [{ id: "o", slug: "systems-integration", title: "Systems Integration" }],
      },
      evaluateGates({}),
    );
    expect(links.map((link) => link.href)).toEqual(
      expect.arrayContaining(["/products/fauward", "/offers/systems-integration"]),
    );
    expect(JSON.stringify(links)).not.toContain("not-a-product");
  });
});
