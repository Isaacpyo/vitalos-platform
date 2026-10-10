import { describe, expect, it } from "vitest";
import { redirectIssues } from "../schemaTypes/rules/redirect";
import { slugify } from "../schemaTypes/shared";
import { redirectDraftId } from "./slug-redirect";

// ReDoS guard: CodeQL js/polynomial-redos. User-controlled slugs and paths must be processed in
// linear time even when hostile and 100 KB long.
const hostile = [
  "-".repeat(100_000) + "!",
  "!-".repeat(50_000),
  "a" + "-!".repeat(50_000) + "-",
  "/" + "a/".repeat(50_000),
  " ".repeat(100_000) + "x",
];

describe("hostile 100 KB input stays linear", () => {
  it.each(hostile.map((input, index) => [index, input] as const))(
    "redirectDraftId, slugify and redirect rules finish in under 50 ms (case %i)",
    (_index, input) => {
      const start = performance.now();
      redirectDraftId(input);
      slugify(input);
      redirectIssues({ source: input, status: 301, destination: input });
      expect(performance.now() - start).toBeLessThan(50);
    },
  );

  it("keeps the ids and slugs produced for ordinary input", () => {
    expect(redirectDraftId("/what-we-do/old")).toBe("drafts.redirect-what-we-do-old");
    expect(redirectDraftId("//a--b//")).toBe("drafts.redirect-a-b");
    expect(redirectDraftId("/")).toBe("drafts.redirect-root");
    expect(slugify("AI & Data -- Platform!")).toBe("ai-and-data-platform");
    expect(slugify("---")).toBe("");
  });
});
