import { describe, expect, it } from "vitest";
import { plannedUrlChange } from "../schemaTypes/document-href";
import { evaluatePublishReadiness } from "./publish-guard";
import { buildRedirectDraft, redirectDraftId } from "./slug-redirect";

const today = "2026-10-10";
const approved = (overrides: Record<string, unknown> = {}) => ({
  _type: "practice",
  governance: {
    owner: "Example Owner (fixture)",
    editorialStatus: "approved",
    reviewDate: "2027-01-01",
  },
  ...overrides,
});

describe("publish guard (Stage 8 §21; Stage 10 §9)", () => {
  it("allows an approved, valid, non-controlled draft", () => {
    expect(evaluatePublishReadiness({ document: approved(), markers: [], today })).toEqual({
      allowed: true,
      reasons: [],
    });
  });

  it.each(["draft", "review", "needs-review", "archived"])(
    "blocks publishing while the status is %s",
    (editorialStatus) => {
      const decision = evaluatePublishReadiness({
        document: approved({
          governance: {
            owner: "Example Owner (fixture)",
            editorialStatus,
            reviewDate: "2027-01-01",
          },
        }),
        markers: [],
        today,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reasons.join(" ")).toMatch(/must be Approved/);
    },
  );

  it("blocks when the status is missing", () => {
    const decision = evaluatePublishReadiness({
      document: { _type: "practice" },
      markers: [],
      today,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/not set/);
  });

  it("blocks when governance is incomplete", () => {
    const decision = evaluatePublishReadiness({
      document: approved({ governance: { editorialStatus: "approved" } }),
      markers: [],
      today,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toEqual([
      "Governance needs a content owner.",
      "Governance needs a review date.",
    ]);
  });

  it("blocks an approved draft whose review date has passed", () => {
    const decision = evaluatePublishReadiness({
      document: approved({
        governance: {
          owner: "Example Owner (fixture)",
          editorialStatus: "approved",
          reviewDate: "2026-10-09",
        },
      }),
      markers: [],
      today,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/Review date has passed/);
  });

  it("blocks on validation errors but not on warnings", () => {
    const withWarning = evaluatePublishReadiness({
      document: approved(),
      markers: [{ level: "warning", message: "advisory" }],
      today,
    });
    expect(withWarning.allowed).toBe(true);
    const withError = evaluatePublishReadiness({
      document: approved(),
      markers: [{ level: "error" }, { level: "error" }, { level: "warning" }],
      today,
    });
    expect(withError.allowed).toBe(false);
    expect(withError.reasons).toEqual(["Fix 2 validation errors first."]);
  });

  it("blocks while validation is still running", () => {
    const decision = evaluatePublishReadiness({
      document: approved(),
      markers: [],
      isValidating: true,
      today,
    });
    expect(decision.allowed).toBe(false);
  });

  it("blocks controlled content so it never reaches the dataset", () => {
    const decision = evaluatePublishReadiness({
      document: approved({
        _type: "trustItem",
        evidence: { evidenceStatus: "verified", classification: "controlled" },
      }),
      markers: [],
      today,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/Controlled content must not be published/);
  });

  it("blocks when there is no draft", () => {
    expect(evaluatePublishReadiness({ document: null, markers: [], today }).allowed).toBe(false);
  });
});

describe("slug-change redirect (Stage 10 §9)", () => {
  it("plans a URL change only when a published document's public URL moves", () => {
    expect(
      plannedUrlChange("practice", { slug: { current: "old" } }, { slug: { current: "new" } }),
    ).toEqual({ from: "/what-we-do/old", to: "/what-we-do/new" });
    expect(
      plannedUrlChange("practice", { slug: { current: "same" } }, { slug: { current: "same" } }),
    ).toBeNull();
    expect(plannedUrlChange("practice", null, { slug: { current: "new" } })).toBeNull();
    expect(
      plannedUrlChange("practice", { slug: { current: "old" } }, { slug: { current: "Bad Slug" } }),
    ).toBeNull();
  });

  it("covers lab type changes, which move the URL without touching the slug", () => {
    expect(
      plannedUrlChange(
        "labAsset",
        { slug: { current: "x" }, labType: "research" },
        { slug: { current: "x" }, labType: "accelerators" },
      ),
    ).toEqual({ from: "/labs/research/x", to: "/labs/accelerators/x" });
  });

  it("uses routes.ts for every routable type", () => {
    const change = (type: string, from: object, to: object) => plannedUrlChange(type, from, to);
    expect(change("solution", { slug: { current: "a" } }, { slug: { current: "b" } })?.to).toBe(
      "/solutions/b",
    );
    expect(change("offer", { slug: { current: "a" } }, { slug: { current: "b" } })?.to).toBe(
      "/offers/b",
    );
    expect(change("caseStudy", { slug: { current: "a" } }, { slug: { current: "b" } })?.to).toBe(
      "/work/b",
    );
    expect(change("person", { slug: { current: "a" } }, { slug: { current: "b" } })?.to).toBe(
      "/people/b",
    );
    expect(change("job", { slug: { current: "a" } }, { slug: { current: "b" } })?.to).toBe(
      "/careers/b",
    );
  });

  it("builds a deterministic draft 301 in review status", () => {
    const change = { from: "/what-we-do/old", to: "/what-we-do/new" };
    const draft = buildRedirectDraft(
      change,
      {
        _type: "practice",
        title: "Example Practice (fixture)",
        governance: { owner: "Example Owner (fixture)", reviewDate: "2027-02-01" },
      },
      today,
    );
    expect(draft).toMatchObject({
      _id: "drafts.redirect-what-we-do-old",
      _type: "redirect",
      source: "/what-we-do/old",
      destination: "/what-we-do/new",
      status: 301,
      locale: "en-GB",
      governance: {
        owner: "Example Owner (fixture)",
        editorialStatus: "review",
        reviewDate: "2027-02-01",
      },
    });
    expect(redirectDraftId(change.from)).toBe(draft._id);
    expect(redirectDraftId("/")).toBe("drafts.redirect-root");
  });
});
