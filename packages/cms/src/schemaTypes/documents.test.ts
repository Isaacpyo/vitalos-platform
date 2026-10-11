import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIXTURE_TODAY,
  evidencePending,
  evidenceVerified,
  ref,
  validDocs,
} from "./testing/fixtures";
import { atPath, emptyDataset, errorsOf, validateDocument, warningsOf } from "./testing/validate";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${FIXTURE_TODAY}T12:00:00Z`));
});
afterEach(() => vi.useRealTimers());

const run = (doc: Record<string, unknown>) => validateDocument(doc, { fetch: emptyDataset });

const figureBlock = {
  _type: "figure",
  _key: "f1",
  kind: "image",
  image: { rightsStatus: "approved", alt: "Example (fixture)" },
};

describe("relationship rules (Stage 10 §15)", () => {
  it("rejects an orphan offer", async () => {
    const findings = await run({ ...validDocs.offer(), solutions: [], practices: [] });
    const errors = errorsOf(findings);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/Orphan offer/);
    expect(errors[0]?.path).toBe("solutions");
  });

  it("accepts an offer linked only to a practice", async () => {
    const findings = await run({
      ...validDocs.offer(),
      solutions: [],
      practices: [{ ...ref("practice-fixture"), _key: "p" }],
    });
    expect(errorsOf(findings)).toEqual([]);
  });

  it("rejects a solution without offers", async () => {
    const findings = await run({ ...validDocs.solution(), offers: [] });
    expect(errorsOf(findings).length).toBeGreaterThanOrEqual(1);
    expect(errorsOf(atPath(findings, "offers"))).not.toHaveLength(0);
  });

  it("requires a duration category and next step on offers", async () => {
    const offer: Record<string, unknown> = { ...validDocs.offer() };
    delete offer["durationCategory"];
    delete offer["nextStep"];
    const paths = errorsOf(await run(offer)).map((f) => f.path);
    expect(paths).toContain("durationCategory");
    expect(paths).toContain("nextStep");
  });
});

describe("case study evidence rules (Stage 10 §17)", () => {
  const named = () => ({
    ...validDocs.caseStudy(),
    clientDisplay: "named",
    clientName: "Example Client Ltd (fixture)",
  });

  it("rejects a named client without permission evidence", async () => {
    const findings = await run(named());
    const errors = errorsOf(findings);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe("permissionEvidence");
    expect(errors[0]?.message).toMatch(/verified permission evidence/);
  });

  it("rejects a named client whose permission is only pending", async () => {
    const findings = await run({ ...named(), permissionEvidence: evidencePending() });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["permissionEvidence"]);
  });

  it("rejects a named client with no name", async () => {
    const findings = await run({
      ...named(),
      clientName: undefined,
      permissionEvidence: evidenceVerified(),
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["clientName"]);
  });

  it("accepts a named client with verified permission", async () => {
    const findings = await run({ ...named(), permissionEvidence: evidenceVerified() });
    expect(errorsOf(findings)).toEqual([]);
  });

  it("rejects an anonymised case study that still carries the client name", async () => {
    const findings = await run({
      ...validDocs.caseStudy(),
      clientName: "Example Client Ltd (fixture)",
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["clientName"]);
  });

  it("requires a description for an anonymised client", async () => {
    const findings = await run({ ...validDocs.caseStudy(), anonymisedDescriptor: undefined });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["anonymisedDescriptor"]);
  });

  it("requires disclosure approval for screenshots and architecture figures", async () => {
    const withFigure = { ...validDocs.caseStudy(), approach: [figureBlock] };
    expect(errorsOf(await run(withFigure)).map((f) => f.path)).toEqual(["disclosureApproved"]);
    expect(errorsOf(await run({ ...withFigure, disclosureApproved: true }))).toEqual([]);
  });

  it("requires source and context on every metric", async () => {
    const findings = await run({
      ...validDocs.caseStudy(),
      metrics: [
        {
          _type: "outcomeMetric",
          _key: "m1",
          value: "10%",
          descriptor: "Example (fixture)",
          evidence: evidencePending(),
        },
      ],
    });
    expect(
      errorsOf(findings)
        .map((f) => f.path)
        .sort(),
    ).toEqual(["metrics.0.context", "metrics.0.source"]);
  });

  it("requires engagement basis and evidence", async () => {
    const doc: Record<string, unknown> = { ...validDocs.caseStudy() };
    delete doc["engagementBasis"];
    delete doc["evidence"];
    expect(
      errorsOf(await run(doc))
        .map((f) => f.path)
        .sort(),
    ).toEqual(["engagementBasis", "evidence"]);
  });
});

describe("insight rules (Stage 10 §18)", () => {
  it("requires at least one author", async () => {
    const findings = await run({ ...validDocs.insight(), authors: [] });
    expect(errorsOf(findings).map((f) => f.path)).toContain("authors");
  });

  it("rejects an updated date before the published date", async () => {
    const findings = await run({ ...validDocs.insight(), updatedAt: "2026-08-01" });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["updatedAt"]);
  });

  it("requires format, topics, published date and a body", async () => {
    const doc: Record<string, unknown> = { ...validDocs.insight() };
    for (const key of ["format", "topics", "publishedAt", "body"]) delete doc[key];
    expect(
      errorsOf(await run(doc))
        .map((f) => f.path)
        .sort(),
    ).toEqual(["body", "format", "publishedAt", "topics"]);
  });
});

describe("trust item rules (Stage 6 §14; Stage 10 §20)", () => {
  const controlled = () => ({
    ...validDocs.trustItem(),
    evidence: { ...evidenceVerified(), classification: "controlled" },
  });
  const certification = (overrides: Record<string, unknown> = {}) => ({
    _type: "certification",
    _key: "c1",
    name: "Example Certification (fixture)",
    scope: "Example scope (fixture)",
    issuedAt: "2026-01-01",
    expiresAt: "2027-01-01",
    evidence: evidenceVerified(),
    ...overrides,
  });

  it("flags a controlled trust item without blocking validation", async () => {
    const findings = await run(controlled());
    expect(errorsOf(findings)).toEqual([]);
    const flags = warningsOf(findings);
    expect(flags).toHaveLength(1);
    expect(flags[0]?.message).toMatch(/controlled/i);
    expect(flags[0]?.path).toBe("evidence.classification");
  });

  it("rejects public certification and subprocessor rows on a controlled item", async () => {
    const findings = await run({ ...controlled(), certifications: [certification()] });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["certifications"]);
    const subs = await run({
      ...controlled(),
      subprocessors: [
        { _type: "subprocessor", _key: "s", name: "Example (fixture)", purpose: "Example" },
      ],
    });
    expect(errorsOf(subs).map((f) => f.path)).toEqual(["subprocessors"]);
  });

  it("accepts a verified, current certification with scope and dates", async () => {
    const findings = await run({ ...validDocs.trustItem(), certifications: [certification()] });
    expect(errorsOf(findings)).toEqual([]);
    expect(warningsOf(findings)).toEqual([]);
  });

  it("rejects an unverified certification", async () => {
    const findings = await run({
      ...validDocs.trustItem(),
      certifications: [certification({ evidence: evidencePending() })],
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["certifications.0.evidence"]);
  });

  it("requires scope, issue date and expiry on a certification", async () => {
    const findings = await run({
      ...validDocs.trustItem(),
      certifications: [
        certification({ scope: undefined, issuedAt: undefined, expiresAt: undefined }),
      ],
    });
    expect(
      errorsOf(findings)
        .map((f) => f.path)
        .sort(),
    ).toEqual([
      "certifications.0.expiresAt",
      "certifications.0.issuedAt",
      "certifications.0.scope",
    ]);
  });

  it("rejects an expired certification and an expiry before issue", async () => {
    const expired = await run({
      ...validDocs.trustItem(),
      certifications: [certification({ issuedAt: "2024-01-01", expiresAt: "2025-01-01" })],
    });
    expect(errorsOf(expired)[0]?.message).toMatch(/expired/);
    const inverted = await run({
      ...validDocs.trustItem(),
      certifications: [certification({ issuedAt: "2027-01-01", expiresAt: "2026-12-01" })],
    });
    expect(errorsOf(inverted)[0]?.message).toMatch(/after the issue date/);
  });

  it("flags a controlled certification row", async () => {
    const findings = await run({
      ...validDocs.trustItem(),
      certifications: [
        certification({ evidence: { ...evidenceVerified(), classification: "controlled" } }),
      ],
    });
    expect(warningsOf(findings)).toHaveLength(1);
  });

  it("rejects a second item for the same topic", async () => {
    const findings = await validateDocument(validDocs.trustItem(), {
      fetch: (query) => (query.startsWith("count(") ? 1 : null),
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["topic"]);
  });
});

describe("lab asset rules (Stage 10 §19)", () => {
  it("requires known limitations", async () => {
    const doc: Record<string, unknown> = { ...validDocs.labAsset() };
    delete doc["limitations"];
    expect(errorsOf(await run(doc)).map((f) => f.path)).toEqual(["limitations"]);
  });

  it("publishes repository and demo links only for maintained assets", async () => {
    const unmaintained = await run({
      ...validDocs.labAsset(),
      repoUrl: "https://example.invalid/repo",
      demoUrl: "https://example.invalid/demo",
    });
    expect(
      errorsOf(unmaintained)
        .map((f) => f.path)
        .sort(),
    ).toEqual(["demoUrl", "repoUrl"]);
    const maintained = await run({
      ...validDocs.labAsset(),
      maintained: true,
      repoUrl: "https://example.invalid/repo",
    });
    expect(errorsOf(maintained)).toEqual([]);
  });

  it("rejects non-https repository links", async () => {
    const findings = await run({
      ...validDocs.labAsset(),
      maintained: true,
      repoUrl: "http://example.invalid/repo",
    });
    expect(errorsOf(findings).map((f) => f.path)).toContain("repoUrl");
  });

  it("requires verified support evidence for a production product", async () => {
    const asset = { ...validDocs.labAsset(), maturity: "production-product" };
    expect(errorsOf(await run(asset)).map((f) => f.path)).toEqual(["supportEvidence"]);
    expect(
      errorsOf(await run({ ...asset, supportEvidence: evidencePending() })).map((f) => f.path),
    ).toEqual(["supportEvidence"]);
    expect(errorsOf(await run({ ...asset, supportEvidence: evidenceVerified() }))).toEqual([]);
  });

  it("keeps slugs unique per lab type", async () => {
    const findings = await validateDocument(validDocs.labAsset(), {
      fetch: (query) => (query.startsWith("count(") ? 1 : null),
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["slug.current"]);
  });
});

describe("job rules", () => {
  it("requires an application link and description while open", async () => {
    const findings = await run({ ...validDocs.job(), status: "open" });
    expect(
      errorsOf(findings)
        .map((f) => f.path)
        .sort(),
    ).toEqual(["applicationUrl", "description"]);
  });

  it("rejects an open role whose valid-through date has passed", async () => {
    const findings = await run({
      ...validDocs.job(),
      status: "open",
      applicationUrl: "https://example.invalid/apply",
      description: validDocs.insight().body,
      validThrough: "2026-10-01",
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["validThrough"]);
  });

  it("rejects valid-through before the posting date", async () => {
    const findings = await run({ ...validDocs.job(), validThrough: "2026-09-01" });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["validThrough"]);
  });
});

describe("legal page, route page, homepage, settings and person rules", () => {
  it("restricts legal slugs", async () => {
    const findings = await run({
      ...validDocs.legalPage(),
      slug: { _type: "slug", current: "modern-slavery" },
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["slug.current"]);
    for (const slug of ["privacy", "cookies", "terms", "acceptable-use"]) {
      const ok = await run({ ...validDocs.legalPage(), slug: { _type: "slug", current: slug } });
      expect(errorsOf(ok)).toEqual([]);
    }
  });

  it("rejects badly formed slugs", async () => {
    const findings = await run({
      ...validDocs.practice(),
      slug: { _type: "slug", current: "Not A Slug" },
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["slug.current"]);
  });

  it("keeps contact-only fields off other route pages", async () => {
    const findings = await run({ ...validDocs.routePage(), successMessage: "Thanks (fixture)" });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["successMessage"]);
    const contact = await run({
      ...validDocs.routePage(),
      routeKey: "contact",
      successMessage: "Thanks (fixture)",
      routes: [
        { _type: "contactRoute", _key: "a", intent: "general", label: "General (fixture)" },
        { _type: "contactRoute", _key: "b", intent: "general", label: "Again (fixture)" },
      ],
    });
    expect(errorsOf(contact).map((f) => f.path)).toEqual(["routes.1.intent"]);
  });

  it("keeps route keys unique", async () => {
    const findings = await validateDocument(validDocs.routePage(), {
      fetch: (query) => (query.startsWith("count(") ? 1 : null),
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["routeKey"]);
  });

  it("limits Selected Work to four case studies and rejects duplicate sections", async () => {
    const refs = ["a", "b", "c", "d", "e"].map((id) => ({ ...ref(`case-${id}`), _key: id }));
    const findings = await run({ ...validDocs.homePage(), selectedWork: refs });
    expect(errorsOf(findings).map((f) => f.path)).toContain("selectedWork");
    const duplicate = await run({
      ...validDocs.homePage(),
      homeSections: [
        { _type: "homeSectionHeading", _key: "a", sectionKey: "problems" },
        { _type: "homeSectionHeading", _key: "b", sectionKey: "problems" },
      ],
    });
    expect(errorsOf(duplicate).map((f) => f.path)).toEqual(["homeSections.1.sectionKey"]);
  });

  it("requires evidence on credibility-strip items", async () => {
    const findings = await run({
      ...validDocs.homePage(),
      proof: [{ _type: "proofItem", _key: "p", label: "Example marker (fixture)" }],
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["proof.0.evidence"]);
  });

  it("warns on a malformed company number and rejects non-https social links", async () => {
    const findings = await run({
      ...validDocs.siteSettings(),
      companyNumber: "12-34",
      social: [
        {
          _type: "socialLink",
          _key: "s",
          label: "Example",
          href: "http://example.invalid",
          verified: false,
        },
      ],
    });
    expect(warningsOf(findings).map((f) => f.path)).toEqual(["companyNumber"]);
    expect(errorsOf(findings).length).toBeGreaterThan(0);
    const ok = await run({ ...validDocs.siteSettings(), companyNumber: "SC123456" });
    expect(warningsOf(ok)).toEqual([]);
  });

  it("rejects malformed contact emails", async () => {
    const findings = await run({ ...validDocs.siteSettings(), contactEmail: "not-an-email" });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["contactEmail"]);
  });

  it("requires https profile links on a person", async () => {
    const findings = await run({
      ...validDocs.person(),
      sameAs: [
        { _type: "profileLink", _key: "a", url: "http://example.invalid/me", verified: true },
      ],
    });
    expect(errorsOf(findings).length).toBeGreaterThan(0);
  });

  it("requires evidence on every credential", async () => {
    const findings = await run({
      ...validDocs.person(),
      credentials: [{ _type: "credential", _key: "c", label: "Example credential (fixture)" }],
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["credentials.0.evidence"]);
  });
});

describe("governance on documents", () => {
  it("rejects an approved document with a lapsed review date", async () => {
    const findings = await run({
      ...validDocs.practice(),
      governance: { ...validDocs.practice().governance, reviewDate: "2026-01-01" },
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["governance.reviewDate"]);
  });

  it("requires governance and a title on every practice", async () => {
    const doc: Record<string, unknown> = { ...validDocs.practice() };
    delete doc["governance"];
    delete doc["title"];
    expect(
      errorsOf(await run(doc))
        .map((f) => f.path)
        .sort(),
    ).toEqual(["governance", "title"]);
  });
});

describe("slug change warning (Stage 10 §9)", () => {
  it("warns when a published document's URL would change", async () => {
    const findings = await validateDocument(validDocs.practice(), {
      fetch: (query) =>
        query.includes("[0]") ? { slug: { current: "old-practice" } } : emptyDataset(query, {}),
    });
    expect(errorsOf(findings)).toEqual([]);
    const warnings = warningsOf(findings);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(
      /\/what-we-do\/old-practice to \/what-we-do\/example-practice/,
    );
  });

  it("stays quiet when the document is unpublished or the slug is unchanged", async () => {
    expect(warningsOf(await run(validDocs.practice()))).toEqual([]);
    const same = await validateDocument(validDocs.practice(), {
      fetch: (query) =>
        query.includes("[0]") ? { slug: { current: "example-practice" } } : emptyDataset(query, {}),
    });
    expect(warningsOf(same)).toEqual([]);
  });
});
