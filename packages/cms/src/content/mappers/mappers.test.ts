import { describe, expect, it } from "vitest";
import {
  mapCaseStudy,
  mapCaseStudySummary,
  mapContactPage,
  mapCta,
  mapGateCounts,
  mapHomePage,
  mapImage,
  mapIndustry,
  mapInsight,
  mapInsightSummary,
  mapJob,
  mapLabAsset,
  mapPerson,
  mapPractice,
  mapRichText,
  mapSiteSettings,
  mapSitemap,
  mapSolution,
  mapTrustItem,
} from "./index";
import type { MapContext, RawBlock } from "./index";
import { evaluateGates } from "../gates";

const ctx: MapContext = { statuses: ["approved"], today: "2026-10-10", preview: false };
const previewCtx: MapContext = {
  statuses: ["approved", "needs-review", "review", "draft"],
  today: "2026-10-10",
  preview: true,
};

const SECRET = "REF-SECRET-0001";
const publicEvidence = {
  evidenceStatus: "verified",
  classification: "public",
  verifiedAt: "2026-01-01",
};
const ident = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  editorialStatus: "approved",
  slug: id,
  title: `Title ${id}`,
  ...extra,
});
const goodImage = {
  url: "https://example.invalid/a.png",
  alt: "Alt",
  rightsStatus: "approved",
  width: 10,
  height: 10,
};

describe("publication status", () => {
  it("drops archived, draft and in-review documents from published reads", () => {
    for (const editorialStatus of [
      "archived",
      "draft",
      "review",
      "needs-review",
      null,
      undefined,
    ]) {
      expect(mapPractice(ident("p", { editorialStatus, proposition: "x" }), ctx)).toBeNull();
    }
    expect(mapPractice(ident("p", { proposition: "x" }), ctx)).not.toBeNull();
  });

  it("shows in-progress documents in preview but never archived ones", () => {
    expect(
      mapPractice(ident("p", { editorialStatus: "draft", proposition: "x" }), previewCtx),
    ).not.toBeNull();
    expect(
      mapPractice(ident("p", { editorialStatus: "archived", proposition: "x" }), previewCtx),
    ).toBeNull();
  });

  it("needs an id, a slug and a title", () => {
    expect(mapPractice({ ...ident("p"), slug: null }, ctx)).toBeNull();
    expect(mapPractice({ ...ident("p"), title: " " }, ctx)).toBeNull();
    expect(mapPractice({ ...ident("p"), id: null }, ctx)).toBeNull();
  });

  it("uses the same id for a draft and its published document", () => {
    expect(mapPractice(ident("drafts.p", { slug: "p" }), previewCtx)?.id).toBe("p");
  });
});

describe("weak relations", () => {
  it("unions both directions without duplicates and drops non-public entries", () => {
    const view = mapPractice(
      ident("p", {
        solutions: [
          ident("s1"),
          ident("s2"),
          ident("s1"), // reverse lookup found the same solution
          ident("s3", { editorialStatus: "archived" }),
          ident("s4", { editorialStatus: "draft" }),
          null,
        ],
      }),
      ctx,
    );
    expect(view?.solutions.map((s) => s.id)).toEqual(["s1", "s2"]);
  });
});

describe("case studies", () => {
  const study = (extra: Record<string, unknown> = {}) => ({
    ...ident("cs"),
    engagementBasis: "contracted-by-vitalos",
    clientDisplay: "anonymised",
    anonymisedDescriptor: "A mid-sized example firm (fixture)",
    evidence: publicEvidence,
    ...extra,
  });

  it("drops controlled, unclassified and archived case studies", () => {
    expect(
      mapCaseStudy(study({ evidence: { ...publicEvidence, classification: "controlled" } }), ctx),
    ).toBeNull();
    expect(mapCaseStudy(study({ evidence: { evidenceStatus: "verified" } }), ctx)).toBeNull();
    expect(mapCaseStudy(study({ evidence: null }), ctx)).toBeNull();
    expect(mapCaseStudy(study({ editorialStatus: "archived" }), ctx)).toBeNull();
    expect(
      mapCaseStudySummary(
        study({ evidence: { ...publicEvidence, classification: "controlled" } }),
        ctx,
      ),
    ).toBeUndefined();
  });

  it("shows a named client only with verified permission", () => {
    const named = { clientDisplay: "named", clientName: "Example Client (fixture)" };
    const denied = mapCaseStudy(study({ ...named, namedPermitted: false }), ctx);
    expect(denied?.clientDisplay).toBe("anonymised");
    expect(denied).not.toHaveProperty("clientName");
    expect(JSON.stringify(denied)).not.toContain("Example Client");
    const allowed = mapCaseStudy(study({ ...named, namedPermitted: true }), ctx);
    expect(allowed).toMatchObject({
      clientDisplay: "named",
      clientName: "Example Client (fixture)",
    });
  });

  it("builds the summary client label from the named client or the anonymised descriptor", () => {
    expect(mapCaseStudySummary(study(), ctx)?.clientLabel).toBe(
      "A mid-sized example firm (fixture)",
    );
    expect(
      mapCaseStudySummary(
        study({
          clientDisplay: "named",
          namedPermitted: true,
          clientName: "Example Client (fixture)",
        }),
        ctx,
      )?.clientLabel,
    ).toBe("Example Client (fixture)");
    expect(
      mapCaseStudySummary(
        study({
          clientDisplay: "named",
          namedPermitted: false,
          clientName: "Example Client (fixture)",
        }),
        ctx,
      )?.clientLabel,
    ).toBe("A mid-sized example firm (fixture)");
  });

  it("keeps only verified, public, sourced metrics", () => {
    const metric = (extra: Record<string, unknown>) => ({
      value: "1 (fixture)",
      descriptor: "d",
      source: "s",
      evidence: publicEvidence,
      ...extra,
    });
    const view = mapCaseStudy(
      study({
        metrics: [
          metric({}),
          metric({ evidence: { ...publicEvidence, evidenceStatus: "pending" } }),
          metric({ evidence: { ...publicEvidence, classification: "controlled" } }),
          metric({ source: "" }),
          metric({ value: null }),
        ],
      }),
      ctx,
    );
    expect(view?.metrics).toHaveLength(1);
  });

  it("shows a testimonial only when permission is granted and it is attributed", () => {
    const testimonial = { quote: "q", attribution: "a (fixture)", permissionStatus: "granted" };
    expect(mapCaseStudy(study({ testimonial }), ctx)?.testimonial).toEqual({
      quote: "q",
      attribution: "a (fixture)",
    });
    expect(
      mapCaseStudy(study({ testimonial: { ...testimonial, permissionStatus: "pending" } }), ctx)
        ?.testimonial,
    ).toBeUndefined();
    expect(
      mapCaseStudy(study({ testimonial: { ...testimonial, permissionStatus: undefined } }), ctx)
        ?.testimonial,
    ).toBeUndefined();
    expect(
      mapCaseStudy(study({ testimonial: { ...testimonial, attribution: "" } }), ctx)?.testimonial,
    ).toBeUndefined();
  });

  it("never carries an internal evidence pointer, even if the raw data does", () => {
    const view = mapCaseStudy(
      study({
        evidenceReference: SECRET,
        evidenceOwner: SECRET,
        permissionEvidence: { evidenceReference: SECRET },
        evidence: { ...publicEvidence, evidenceReference: SECRET, evidenceOwner: SECRET },
        testimonial: {
          quote: "q",
          attribution: "a",
          permissionStatus: "granted",
          permissionEvidence: SECRET,
        },
        metrics: [
          {
            value: "1",
            descriptor: "d",
            source: "s",
            evidence: { ...publicEvidence, evidenceReference: SECRET },
          },
        ],
      }),
      ctx,
    );
    expect(JSON.stringify(view)).not.toContain(SECRET);
  });
});

describe("images", () => {
  it("accepts only approved-rights images with alternative text and dimensions", () => {
    expect(mapImage(goodImage)).toMatchObject({ url: goodImage.url, alt: "Alt" });
    expect(mapImage({ ...goodImage, rightsStatus: "pending" })).toBeUndefined();
    expect(mapImage({ ...goodImage, rightsStatus: null })).toBeUndefined();
    expect(mapImage({ ...goodImage, alt: "" })).toBeUndefined();
    expect(mapImage({ ...goodImage, alt: "", decorative: true })).toMatchObject({
      alt: "",
      decorative: true,
    });
    expect(mapImage({ ...goodImage, width: null })).toBeUndefined();
    expect(mapImage({ ...goodImage, url: "http://example.invalid/a.png" })).toBeUndefined();
  });

  it("hides unapproved portraits and Open Graph images", () => {
    const person = mapPerson(
      ident("pe", {
        name: "Example Person (fixture)",
        portrait: { ...goodImage, rightsStatus: "pending" },
      }),
      ctx,
    );
    expect(person?.portrait).toBeUndefined();
    const practice = mapPractice(
      ident("p", { proposition: "x", seo: { ogImage: { ...goodImage, rightsStatus: "pending" } } }),
      ctx,
    );
    expect(practice?.seo.ogImage).toBeUndefined();
  });
});

describe("trust topics", () => {
  const trust = (extra: Record<string, unknown> = {}) => ({
    id: "t",
    editorialStatus: "approved",
    topic: "certifications",
    title: "Example certifications (fixture)",
    evidence: publicEvidence,
    ...extra,
  });
  const cert = (extra: Record<string, unknown> = {}) => ({
    name: "Example Cert (fixture)",
    scope: "Example scope",
    issuedAt: "2026-01-01",
    expiresAt: "2027-01-01",
    evidence: publicEvidence,
    ...extra,
  });

  it("drops controlled topics", () => {
    expect(
      mapTrustItem(trust({ evidence: { ...publicEvidence, classification: "controlled" } }), ctx),
    ).toBeNull();
    expect(mapTrustItem(trust({ editorialStatus: "archived" }), ctx)).toBeNull();
  });

  it("keeps only verified, scoped, dated and unexpired certifications", () => {
    const view = mapTrustItem(
      trust({
        certifications: [
          cert(),
          cert({ name: "Unverified", evidence: { ...publicEvidence, evidenceStatus: "pending" } }),
          cert({
            name: "Controlled",
            evidence: { ...publicEvidence, classification: "controlled" },
          }),
          cert({ name: "Expired", expiresAt: "2026-10-09" }),
          cert({ name: "No scope", scope: null }),
          cert({ name: "No issue date", issuedAt: null }),
          cert({ name: "Expires today", expiresAt: "2026-10-10" }),
        ],
      }),
      ctx,
    );
    expect(view?.certifications.map((c) => c.name)).toEqual([
      "Example Cert (fixture)",
      "Expires today",
    ]);
  });
});

describe("people", () => {
  const person = (extra: Record<string, unknown> = {}) => ({
    ...ident("pe"),
    name: "Example Person (fixture)",
    ...extra,
  });

  it("takes the title from the name", () => {
    const view = mapPerson({ ...person(), title: "ignored" }, ctx);
    expect(view).toMatchObject({
      title: "Example Person (fixture)",
      name: "Example Person (fixture)",
    });
  });

  it("keeps verified https profile links and verified credentials only", () => {
    const view = mapPerson(
      person({
        sameAs: [
          { label: "ok", url: "https://example.invalid/a", verified: true },
          { label: "unverified", url: "https://example.invalid/b", verified: false },
          { label: "http", url: "http://example.invalid/c", verified: true },
          { label: "js", url: "javascript:alert(1)", verified: true },
        ],
        credentials: [
          { label: "ok", evidence: publicEvidence },
          { label: "pending", evidence: { ...publicEvidence, evidenceStatus: "pending" } },
          { label: "controlled", evidence: { ...publicEvidence, classification: "controlled" } },
        ],
      }),
      ctx,
    );
    expect(view?.sameAs).toEqual(["https://example.invalid/a"]);
    expect(view?.credentials.map((c) => c.label)).toEqual(["ok"]);
  });
});

describe("lab assets", () => {
  const lab = (extra: Record<string, unknown> = {}) => ({
    ...ident("lab"),
    labType: "open-source",
    maturity: "prototype",
    limitations: "Fixture only",
    maintained: true,
    repoUrl: "https://example.invalid/repo",
    demoUrl: "https://example.invalid/demo",
    evidence: publicEvidence,
    supportVerified: false,
    ...extra,
  });

  it("shows repository and demo links only for maintained assets", () => {
    expect(mapLabAsset(lab(), ctx)).toMatchObject({
      repoUrl: "https://example.invalid/repo",
      demoUrl: "https://example.invalid/demo",
    });
    const unmaintained = mapLabAsset(lab({ maintained: false }), ctx);
    expect(unmaintained).not.toHaveProperty("repoUrl");
    expect(unmaintained).not.toHaveProperty("demoUrl");
    expect(mapLabAsset(lab({ repoUrl: "http://example.invalid/repo" }), ctx)).not.toHaveProperty(
      "repoUrl",
    );
  });

  it("drops controlled assets and production-product claims without verified support", () => {
    expect(
      mapLabAsset(lab({ evidence: { ...publicEvidence, classification: "controlled" } }), ctx),
    ).toBeNull();
    expect(mapLabAsset(lab({ maturity: "production-product" }), ctx)).toBeNull();
    expect(
      mapLabAsset(lab({ maturity: "production-product", supportVerified: true }), ctx),
    ).not.toBeNull();
  });

  it("requires limitations when published but not in preview", () => {
    expect(mapLabAsset(lab({ limitations: null }), ctx)).toBeNull();
    expect(
      mapLabAsset(lab({ limitations: null, editorialStatus: "draft" }), previewCtx)?.limitations,
    ).toBe("");
  });
});

describe("insights", () => {
  const author = ident("author", { title: "Example Person (fixture)" });
  const insight = (extra: Record<string, unknown> = {}) => ({
    ...ident("i"),
    format: "insight-article",
    publishedAt: "2026-01-01",
    authors: [author],
    ...extra,
  });

  it("needs at least one public named author", () => {
    expect(mapInsight(insight(), ctx)).not.toBeNull();
    expect(mapInsight(insight({ authors: [] }), ctx)).toBeNull();
    expect(mapInsight(insight({ authors: null }), ctx)).toBeNull();
    expect(
      mapInsight(insight({ authors: [{ ...author, editorialStatus: "draft" }] }), ctx),
    ).toBeNull();
    expect(mapInsightSummary(insight({ authors: [] }), ctx)).toBeUndefined();
  });
});

describe("jobs", () => {
  const job = (extra: Record<string, unknown> = {}) => ({
    ...ident("j"),
    datePosted: "2026-09-01",
    status: "open",
    validThrough: "2026-12-31",
    applicationUrl: "https://example.invalid/apply",
    ...extra,
  });

  it("is open only while its validity has not passed", () => {
    expect(mapJob(job(), ctx)).toMatchObject({
      status: "open",
      applicationUrl: "https://example.invalid/apply",
    });
    expect(mapJob(job({ validThrough: "2026-10-10" }), ctx)?.status).toBe("open");
    const expired = mapJob(job({ validThrough: "2026-10-09" }), ctx);
    expect(expired?.status).toBe("closed");
    expect(expired).not.toHaveProperty("applicationUrl");
    expect(mapJob(job({ status: "closed" }), ctx)?.status).toBe("closed");
  });

  it("only offers an https application link", () => {
    expect(mapJob(job({ applicationUrl: "http://example.invalid/apply" }), ctx)).not.toHaveProperty(
      "applicationUrl",
    );
  });
});

describe("rich text", () => {
  const block = (extra: Record<string, unknown> = {}): RawBlock => ({
    _type: "block",
    _key: "b1",
    style: "normal",
    children: [{ _type: "span", _key: "s1", text: "Hello", marks: ["strong", "L1", "L2", "L3"] }],
    markDefs: [
      { _type: "link", _key: "L1", href: "https://example.invalid/ok" },
      { _type: "link", _key: "L2", href: "http://example.invalid/insecure" },
      {
        _type: "internalLink",
        _key: "L3",
        target: { _type: "practice", slug: "p", editorialStatus: "archived" },
      },
    ],
    ...extra,
  });

  it("drops unsafe and unresolvable links and the marks that pointed to them", () => {
    const [mapped] = mapRichText([block()], ctx);
    expect(mapped?.markDefs).toEqual([
      { _type: "link", _key: "L1", href: "https://example.invalid/ok" },
    ]);
    expect((mapped?.children as { marks: string[] }[])[0]?.marks).toEqual(["strong", "L1"]);
  });

  it("resolves internal links to routes for public targets only", () => {
    const [mapped] = mapRichText(
      [
        block({
          markDefs: [
            {
              _type: "internalLink",
              _key: "L3",
              target: { _type: "practice", slug: "p", editorialStatus: "approved" },
            },
          ],
        }),
      ],
      ctx,
    );
    expect(mapped?.markDefs).toEqual([
      { _type: "link", _key: "L3", href: "/what-we-do/p", internal: true },
    ]);
    // A controlled case study is never linked.
    const [controlled] = mapRichText(
      [
        block({
          markDefs: [
            {
              _type: "internalLink",
              _key: "L3",
              target: {
                _type: "caseStudy",
                slug: "c",
                editorialStatus: "approved",
                classification: "controlled",
              },
            },
          ],
        }),
      ],
      ctx,
    );
    expect(controlled?.markDefs).toEqual([]);
  });

  it("drops figures with unapproved images, diagrams without a text alternative and unknown blocks", () => {
    const blocks = mapRichText(
      [
        {
          _type: "figure",
          _key: "f1",
          kind: "image",
          image: { ...goodImage, rightsStatus: "pending" },
        },
        { _type: "figure", _key: "f2", kind: "diagram", image: goodImage },
        {
          _type: "figure",
          _key: "f3",
          kind: "diagram",
          image: goodImage,
          textAlternative: "A diagram",
        },
        { _type: "html", _key: "h", html: "<script>alert(1)</script>" },
        { _type: "pullQuote", _key: "q1", quote: "q" },
        { _type: "pullQuote", _key: "q2", quote: "q", attribution: "a" },
        {
          _type: "dataTable",
          _key: "t1",
          caption: "c",
          columns: ["a", "b"],
          rows: [{ cells: ["1"] }],
        },
        {
          _type: "dataTable",
          _key: "t2",
          caption: "c",
          columns: ["a", "b"],
          rows: [{ cells: ["1", "2"] }],
        },
        null,
        "text",
      ] as unknown as RawBlock[],
      ctx,
    );
    expect(blocks.map((b) => b._key)).toEqual(["f3", "q2", "t2"]);
  });
});

describe("calls to action", () => {
  it("resolves route keys and public targets and drops the rest", () => {
    expect(mapCta({ label: "Talk", routeKey: "contact", intent: "project" }, ctx)).toEqual({
      label: "Talk",
      href: "/contact",
      intent: "project",
    });
    expect(
      mapCta(
        { label: "Read", target: { _type: "insight", slug: "i", editorialStatus: "approved" } },
        ctx,
      )?.href,
    ).toBe("/insights/i");
    expect(
      mapCta(
        { label: "Read", target: { _type: "insight", slug: "i", editorialStatus: "draft" } },
        ctx,
      ),
    ).toBeUndefined();
    expect(mapCta({ label: "", routeKey: "contact" }, ctx)).toBeUndefined();
    expect(mapCta({ label: "x" }, ctx)).toBeUndefined();
    expect(mapCta({ label: "x", routeKey: "contact", intent: "made-up" }, ctx)).not.toHaveProperty(
      "intent",
    );
  });
});

describe("pages", () => {
  it("shows only authored home headings for known sections and verified proof and work", () => {
    const home = mapHomePage(
      {
        editorialStatus: "approved",
        homeSections: [
          { sectionKey: "problems", visibleHeading: "Authored heading" },
          { sectionKey: "practices", visibleHeading: null },
          { sectionKey: "made-up", visibleHeading: "Nope" },
        ],
        proof: [
          { label: "ok", evidence: publicEvidence },
          { label: "pending", evidence: { ...publicEvidence, evidenceStatus: "pending" } },
          { label: "controlled", evidence: { ...publicEvidence, classification: "controlled" } },
        ],
        selectedWork: [
          { ...ident("cs1"), engagementBasis: "contracted-by-vitalos", evidence: publicEvidence },
          {
            ...ident("cs2"),
            engagementBasis: "contracted-by-vitalos",
            evidence: { ...publicEvidence, evidenceStatus: "pending" },
          },
        ],
      },
      ctx,
    );
    expect(home?.headings).toEqual({ problems: "Authored heading" });
    expect(home?.proof.map((p) => p.label)).toEqual(["ok"]);
    expect(home?.selectedWork.map((w) => w.id)).toEqual(["cs1"]);
    expect(mapHomePage(null, ctx)).toBeNull();
  });

  it("shows verified social channels and approved logos only", () => {
    const settings = mapSiteSettings(
      {
        editorialStatus: "approved",
        social: [
          { label: "ok", href: "https://example.invalid/s", verified: true },
          { label: "unverified", href: "https://example.invalid/u", verified: false },
          { label: "http", href: "http://example.invalid/h", verified: true },
        ],
        logo: { ...goodImage, rightsStatus: "pending" },
      },
      ctx,
    );
    expect(settings.social).toEqual([{ label: "ok", href: "https://example.invalid/s" }]);
    expect(settings).not.toHaveProperty("logo");
    expect(mapSiteSettings(null, ctx)).toEqual({});
    expect(mapSiteSettings({ editorialStatus: "draft", legalName: "x" }, ctx)).toEqual({});
  });

  it("keeps unique, known contact intents", () => {
    const page = mapContactPage(
      {
        editorialStatus: "approved",
        key: "contact",
        heading: "Contact (fixture)",
        routes: [
          { intent: "project", label: "Project" },
          { intent: "project", label: "Duplicate" },
          { intent: "made-up", label: "Unknown" },
          { intent: "general", label: "" },
        ],
      },
      ctx,
    );
    expect(page?.routes).toEqual([{ intent: "project", label: "Project" }]);
    expect(page).not.toHaveProperty("expectations");
  });

  it("treats invalid gate counts as zero", () => {
    expect(mapGateCounts({ work: 2, insights: -1, labs: Number.NaN, industries: null })).toEqual(
      evaluateGates({ work: 2 }),
    );
  });

  it("excludes noindex documents, closed gates and controlled documents from the sitemap", () => {
    const entry = (slug: string, extra: Record<string, unknown> = {}) => ({
      slug,
      updatedAt: "2026-01-01",
      editorialStatus: "approved",
      ...extra,
    });
    const raw = {
      practice: [
        entry("a"),
        entry("hidden", { noindex: true }),
        entry("old", { editorialStatus: "archived" }),
      ],
      caseStudy: [
        entry("c1", { classification: "public" }),
        entry("c2", { classification: "controlled" }),
      ],
      labAsset: [entry("l1", { labType: "research", classification: "public" })],
      trustItem: [{ topic: "security", editorialStatus: "approved", classification: "public" }],
    };
    const closed = mapSitemap(raw, evaluateGates(), ctx);
    expect(closed.map((e) => e.path)).toEqual(["/what-we-do/a", "/trust/security"]);
    const open = mapSitemap(raw, evaluateGates({ work: 2, labs: 1 }), ctx);
    expect(open.map((e) => e.path)).toEqual([
      "/what-we-do/a",
      "/work/c1",
      "/labs/research/l1",
      "/trust/security",
      "/labs/research",
    ]);
  });

  it("leaves closed and expired jobs out of the sitemap (closing today is still open)", () => {
    const job = (slug: string, extra: Record<string, unknown> = {}) => ({
      slug,
      updatedAt: "2026-01-01",
      editorialStatus: "approved",
      status: "open",
      ...extra,
    });
    const raw = {
      job: [
        job("open-no-date"),
        job("open-future", { validThrough: "2026-12-31" }),
        job("closes-today", { validThrough: "2026-10-10" }),
        job("closes-today-datetime", { validThrough: "2026-10-10T23:59:00Z" }),
        job("expired", { validThrough: "2026-10-09" }),
        job("closed", { status: "closed" }),
        job("no-status", { status: null }),
      ],
    };
    const paths = mapSitemap(raw, evaluateGates({ careers: 1 }), ctx).map((e) => e.path);
    expect(paths).toEqual([
      "/careers/open-no-date",
      "/careers/open-future",
      "/careers/closes-today",
      "/careers/closes-today-datetime",
    ]);
  });

  it("adds /labs/<type> only for types with a listed asset and only while Labs is open", () => {
    const asset = (slug: string, labType: string, extra: Record<string, unknown> = {}) => ({
      slug,
      labType,
      updatedAt: "2026-01-01",
      editorialStatus: "approved",
      classification: "public",
      ...extra,
    });
    const raw = {
      labAsset: [
        asset("a", "experiments", { updatedAt: "2026-03-01" }),
        asset("b", "experiments", { updatedAt: "2026-02-01" }),
        asset("c", "research", { noindex: true }),
        asset("d", "demonstrators", { classification: "controlled" }),
        asset("e", "not-a-type"),
      ],
    };
    const open = mapSitemap(raw, evaluateGates({ labs: 1 }), ctx);
    expect(open.map((e) => e.path)).toEqual([
      "/labs/experiments/a",
      "/labs/experiments/b",
      "/labs/experiments",
    ]);
    expect(open.at(-1)).toEqual({
      path: "/labs/experiments",
      kind: "route",
      lastModified: "2026-03-01",
    });
    expect(mapSitemap(raw, evaluateGates(), ctx)).toEqual([]);
  });
});

describe("robustness", () => {
  it("never throws on malformed raw data", () => {
    const garbage = [
      {},
      [],
      "x",
      1,
      true,
      { id: {}, slug: [], title: 5, editorialStatus: "approved" },
    ];
    for (const value of garbage) {
      expect(() => mapPractice(value as never, ctx)).not.toThrow();
      expect(() => mapSolution(value as never, ctx)).not.toThrow();
      expect(() => mapIndustry(value as never, ctx)).not.toThrow();
      expect(() => mapCaseStudy(value as never, ctx)).not.toThrow();
      expect(() => mapHomePage(value as never, ctx)).not.toThrow();
    }
  });
});
