import { describe, expect, it } from "vitest";
import { redirectIssues, redirectLookupIssues, type RedirectRecord } from "./rules/redirect";
import { validDocs } from "./testing/fixtures";
import { emptyDataset, errorsOf, validateDocument } from "./testing/validate";

const redirect = (overrides: Record<string, unknown> = {}) => ({
  source: "/old-example",
  status: 301,
  destination: "/what-we-do",
  ...overrides,
});

const messages = (doc: unknown) => redirectIssues(doc).map((entry) => entry.message);

describe("redirect source rules (Stage 10 §11)", () => {
  it("accepts a plain internal path", () => {
    expect(redirectIssues(redirect())).toEqual([]);
  });

  it("requires a source", () => {
    expect(redirectIssues(redirect({ source: undefined })).map((i) => i.path)).toEqual([
      ["source"],
    ]);
  });

  it("requires the source to start with '/'", () => {
    expect(messages(redirect({ source: "old-example" }))).toEqual(["Must start with '/'."]);
  });

  it("rejects a protocol-relative source", () => {
    expect(messages(redirect({ source: "//evil.invalid/path" })).join(" ")).toMatch(
      /protocol-relative/,
    );
  });

  it("rejects query strings, fragments, spaces and trailing slashes", () => {
    expect(redirectIssues(redirect({ source: "/old?x=1" }))).not.toEqual([]);
    expect(redirectIssues(redirect({ source: "/old#top" }))).not.toEqual([]);
    expect(redirectIssues(redirect({ source: "/old page" }))).not.toEqual([]);
    expect(messages(redirect({ source: "/old/" }))).toEqual(["Remove the trailing slash."]);
  });

  it("rejects a source that is a live page or API route", () => {
    expect(messages(redirect({ source: "/what-we-do" })).join(" ")).toMatch(/live page/);
    expect(
      messages(redirect({ source: "/contact", destination: "/what-we-do" })).join(" "),
    ).toMatch(/live page/);
    expect(messages(redirect({ source: "/api/enquiries" })).join(" ")).toMatch(/live page/);
  });

  it("allows retired paths that look like dynamic routes' parents", () => {
    // Dynamic detail routes are not shadowed: /what-we-do/retired-practice is a legitimate source.
    expect(redirectIssues(redirect({ source: "/what-we-do/retired-practice" }))).toEqual([]);
  });
});

describe("redirect status and destination rules", () => {
  it("allows only 301, 308 and 410", () => {
    expect(redirectIssues(redirect({ status: 302 })).map((i) => i.path)).toEqual([["status"]]);
    for (const status of [301, 308]) expect(redirectIssues(redirect({ status }))).toEqual([]);
  });

  it("requires a destination for 301 and 308", () => {
    expect(redirectIssues(redirect({ destination: undefined })).map((i) => i.path)).toEqual([
      ["destination"],
    ]);
  });

  it("allows 410 only without a destination", () => {
    expect(redirectIssues(redirect({ status: 410, destination: undefined }))).toEqual([]);
    expect(messages(redirect({ status: 410 })).join(" ")).toMatch(/410/);
  });

  it("accepts an https destination and rejects http and protocol-relative ones", () => {
    expect(redirectIssues(redirect({ destination: "https://example.invalid/new" }))).toEqual([]);
    expect(redirectIssues(redirect({ destination: "http://example.invalid/new" }))).not.toEqual([]);
    expect(redirectIssues(redirect({ destination: "//example.invalid/new" }))).not.toEqual([]);
  });

  it("rejects a redirect to itself", () => {
    expect(messages(redirect({ source: "/loop", destination: "/loop" })).join(" ")).toMatch(/loop/);
  });
});

describe("redirect uniqueness and chain rejection", () => {
  const lookup = (others: RedirectRecord[]) => ({ others: () => Promise.resolve(others) });
  const existing = (
    source: string,
    destination: string | undefined,
    status = 301,
  ): RedirectRecord => ({
    _id: `redirect-${source}`,
    source,
    status,
    ...(destination ? { destination } : {}),
  });

  it("accepts a redirect that does not touch any other", async () => {
    const found = await redirectLookupIssues(redirect(), "r1", lookup([existing("/a", "/b")]));
    expect(found).toEqual([]);
  });

  it("rejects a duplicate source", async () => {
    const found = await redirectLookupIssues(
      redirect(),
      "r1",
      lookup([existing("/old-example", "/somewhere")]),
    );
    expect(found.map((i) => i.path)).toEqual([["source"]]);
    expect(found[0]?.message).toMatch(/already uses this source/);
  });

  it("rejects a chain where the destination is itself redirected (A -> B, B -> C)", async () => {
    const found = await redirectLookupIssues(
      redirect({ source: "/a", destination: "/b" }),
      "r1",
      lookup([existing("/b", "/c")]),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toEqual(["destination"]);
    expect(found[0]?.message).toMatch(/Redirect chain/);
    expect(found[0]?.message).toMatch(/\/c/);
  });

  it("rejects a chain where another redirect already points at this source", async () => {
    const found = await redirectLookupIssues(
      redirect({ source: "/b", destination: "/c" }),
      "r1",
      lookup([existing("/a", "/b")]),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toEqual(["source"]);
    expect(found[0]?.message).toMatch(/\/a already redirects to \/b/);
  });

  it("rejects a redirect into a gone (410) path", async () => {
    const found = await redirectLookupIssues(
      redirect({ source: "/a", destination: "/b" }),
      "r1",
      lookup([existing("/b", undefined, 410)]),
    );
    expect(found[0]?.message).toMatch(/410/);
  });

  it("ignores external destinations when looking for chains", async () => {
    const found = await redirectLookupIssues(
      redirect({ source: "/a", destination: "https://example.invalid/b" }),
      "r1",
      lookup([existing("/https://example.invalid/b", "/c")]),
    );
    expect(found).toEqual([]);
  });

  it("excludes the draft and published copies of the redirect being edited", async () => {
    const seen: (readonly string[])[] = [];
    await redirectLookupIssues(redirect(), "drafts.r1", {
      others: (ids) => {
        seen.push(ids);
        return Promise.resolve([]);
      },
    });
    expect(seen).toEqual([["r1", "drafts.r1"]]);
  });
});

describe("redirect document validation (schema wiring)", () => {
  const withOthers = (others: RedirectRecord[]) => ({
    fetch: (query: string) =>
      query.includes('_type == "redirect"') ? others : emptyDataset(query, {}),
  });

  it("passes the valid fixture", async () => {
    expect(errorsOf(await validateDocument(validDocs.redirect(), withOthers([])))).toEqual([]);
  });

  it("rejects a chain through the Studio rule wiring", async () => {
    const findings = await validateDocument(
      { ...validDocs.redirect(), source: "/old-example", destination: "/b" },
      withOthers([{ _id: "x", source: "/b", status: 301, destination: "/c" }]),
    );
    const errors = errorsOf(findings);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe("destination");
  });

  it("rejects an invalid source through the Studio rule wiring", async () => {
    const findings = await validateDocument(
      { ...validDocs.redirect(), source: "//old" },
      withOthers([]),
    );
    expect(errorsOf(findings).length).toBeGreaterThan(0);
  });
});
