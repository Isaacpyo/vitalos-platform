import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { richText } from "./objects";
import { FIXTURE_TODAY, evidencePending, evidenceVerified } from "./testing/fixtures";
import { atPath, checkValue, errorsOf, validateObject, warningsOf } from "./testing/validate";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${FIXTURE_TODAY}T12:00:00Z`));
});
afterEach(() => vi.useRealTimers());

describe("seo", () => {
  it("rejects a title over 60 and a description over 160 characters", async () => {
    const findings = await validateObject("seo", {
      title: "t".repeat(61),
      description: "d".repeat(161),
    });
    expect(errorsOf(atPath(findings, "title"))).toHaveLength(1);
    expect(errorsOf(atPath(findings, "description"))).toHaveLength(1);
  });

  it("accepts the limits exactly", async () => {
    const findings = await validateObject("seo", {
      title: "t".repeat(60),
      description: "d".repeat(160),
      noindex: false,
    });
    expect(findings).toEqual([]);
  });
});

describe("governance", () => {
  const governance = (overrides: Record<string, unknown> = {}) => ({
    owner: "Example Owner (fixture)",
    editorialStatus: "approved",
    reviewDate: "2027-01-01",
    ...overrides,
  });

  it("requires owner, status and review date", async () => {
    const findings = await validateObject("governance", {});
    expect(
      errorsOf(findings)
        .map((f) => f.path)
        .sort(),
    ).toEqual(["editorialStatus", "owner", "reviewDate"]);
  });

  it("rejects an approved item whose review date has passed", async () => {
    const findings = await validateObject("governance", governance({ reviewDate: "2026-10-09" }));
    expect(errorsOf(findings)).toHaveLength(1);
    expect(errorsOf(findings)[0]?.message).toMatch(/Review date has passed/);
  });

  it("allows a past review date while the item is not approved", async () => {
    const findings = await validateObject(
      "governance",
      governance({ editorialStatus: "needs-review", reviewDate: "2026-01-01" }),
    );
    expect(findings).toEqual([]);
  });
});

describe("evidence", () => {
  it("holds a pointer, never the evidence: rejects long or multi-line references", async () => {
    const long = await validateObject("evidence", {
      ...evidenceVerified(),
      evidenceReference: "x".repeat(201),
    });
    expect(errorsOf(atPath(long, "evidenceReference"))).toHaveLength(1);
    const multi = await validateObject("evidence", {
      ...evidenceVerified(),
      evidenceReference: "line one\nline two",
    });
    expect(errorsOf(atPath(multi, "evidenceReference"))).toHaveLength(1);
  });

  it("warns when the pointer looks like a web link", async () => {
    const findings = await validateObject("evidence", {
      ...evidenceVerified(),
      evidenceReference: "https://example.invalid/evidence.pdf",
    });
    expect(errorsOf(findings)).toEqual([]);
    expect(warningsOf(findings)).toHaveLength(1);
  });

  it("requires owner, reference and date once verified", async () => {
    const findings = await validateObject("evidence", {
      evidenceStatus: "verified",
      classification: "public",
    });
    expect(
      errorsOf(findings)
        .map((f) => f.path)
        .sort(),
    ).toEqual(["evidenceOwner", "evidenceReference", "verifiedAt"]);
  });

  it("rejects a verification date in the future", async () => {
    const findings = await validateObject("evidence", {
      ...evidenceVerified(),
      verifiedAt: "2026-10-11",
    });
    expect(errorsOf(findings)).toHaveLength(1);
  });

  it("requires an explicit classification and accepts pending evidence", async () => {
    expect(errorsOf(await validateObject("evidence", { evidenceStatus: "pending" }))).toHaveLength(
      1,
    );
    expect(await validateObject("evidence", evidencePending())).toEqual([]);
  });
});

describe("cta", () => {
  it("warns on a generic label such as 'Learn more'", async () => {
    const findings = await validateObject("cta", { label: "Learn more", routeKey: "contact" });
    expect(errorsOf(findings)).toEqual([]);
    expect(warningsOf(findings)).toHaveLength(1);
    expect(warningsOf(findings)[0]?.path).toBe("label");
  });

  it("does not warn on a descriptive label", async () => {
    expect(
      await validateObject("cta", {
        label: "Talk to Vitalos",
        routeKey: "contact",
        intent: "general",
      }),
    ).toEqual([]);
  });

  it("needs exactly one target", async () => {
    expect(errorsOf(await validateObject("cta", { label: "Explore what we do" }))).toHaveLength(1);
    const both = await validateObject("cta", {
      label: "Explore what we do",
      routeKey: "what-we-do",
      internalRef: { _type: "reference", _ref: "practice-fixture" },
    });
    expect(errorsOf(both)).toHaveLength(1);
  });
});

describe("approvedImage", () => {
  it("requires alt text unless decorative", async () => {
    expect(
      errorsOf(await validateObject("approvedImage", { rightsStatus: "pending" })),
    ).toHaveLength(1);
    expect(
      await validateObject("approvedImage", { rightsStatus: "approved", decorative: true }),
    ).toEqual([]);
    expect(
      await validateObject("approvedImage", {
        rightsStatus: "approved",
        alt: "An example (fixture)",
      }),
    ).toEqual([]);
  });

  it("requires a rights status", async () => {
    const findings = await validateObject("approvedImage", { alt: "An example (fixture)" });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["rightsStatus"]);
  });
});

describe("rich text", () => {
  interface Def {
    name?: string;
    type?: string;
    validation?: unknown;
    fields?: Def[];
    marks?: { annotations?: Def[] };
  }
  const block = (richText as unknown as { of: Def[] }).of[0];
  const link = block?.marks?.annotations?.find((entry) => entry.name === "link");
  const href = link?.fields?.find((field) => field.name === "href");

  it("only offers the approved styles, lists and marks", () => {
    const b = block as unknown as {
      styles: { value: string }[];
      lists: { value: string }[];
      marks: { decorators: { value: string }[] };
    };
    expect(b.styles.map((s) => s.value)).toEqual(["normal", "h2", "h3", "h4"]);
    expect(b.lists.map((s) => s.value)).toEqual(["bullet", "number"]);
    expect(b.marks.decorators.map((s) => s.value)).toEqual(["strong", "em", "code"]);
  });

  it("allows only the approved block set", () => {
    const names = (richText as unknown as { of: Def[] }).of.map(
      (entry) => entry.name ?? entry.type,
    );
    expect(names).toEqual(["block", "callout", "pullQuote", "figure", "codeBlock", "dataTable"]);
  });

  it("accepts https links and rejects http and mailto", async () => {
    expect(href).toBeDefined();
    expect(await checkValue(href?.validation, "https://example.invalid/page")).toEqual([]);
    expect(
      errorsOf(await checkValue(href?.validation, "http://example.invalid/page")),
    ).toHaveLength(1);
    expect(errorsOf(await checkValue(href?.validation, "mailto:a@example.invalid"))).toHaveLength(
      1,
    );
  });

  it("requires an attribution on pull quotes", async () => {
    const findings = await validateObject("pullQuote", { quote: "Example quote (fixture)" });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["attribution"]);
    expect(
      await validateObject("pullQuote", {
        quote: "Example quote (fixture)",
        attribution: "A. Person",
      }),
    ).toEqual([]);
  });

  it("requires a text alternative on diagrams", async () => {
    const image = { rightsStatus: "approved", alt: "Example (fixture)" };
    const diagram = await validateObject("figure", { kind: "diagram", image });
    expect(errorsOf(diagram).map((f) => f.path)).toEqual(["textAlternative"]);
    expect(
      await validateObject("figure", {
        kind: "diagram",
        image,
        textAlternative: "Boxes A to B (fixture)",
      }),
    ).toEqual([]);
    expect(await validateObject("figure", { kind: "image", image })).toEqual([]);
  });

  it("requires every table row to match the column count and a caption", async () => {
    const table = {
      caption: "Example table (fixture)",
      columns: ["A", "B"],
      rows: [
        { _type: "tableRow", cells: ["1", "2"] },
        { _type: "tableRow", cells: ["1"] },
      ],
    };
    const findings = await validateObject("dataTable", table);
    expect(errorsOf(findings)).toHaveLength(1);
    expect(errorsOf(findings)[0]?.path).toBe("rows.1");
    expect(
      errorsOf(
        await validateObject("dataTable", { ...table, caption: undefined, rows: [table.rows[0]] }),
      ),
    ).toHaveLength(1);
  });
});

describe("stat, outcomeMetric and testimonial", () => {
  it("rejects an unsourced statistic", async () => {
    const findings = await validateObject("stat", {
      value: "42%",
      descriptor: "Example measure (fixture)",
      evidence: evidencePending(),
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["source"]);
  });

  it("requires evidence on a statistic", async () => {
    const findings = await validateObject("stat", {
      value: "42%",
      descriptor: "Example measure (fixture)",
      source: "Example source (fixture)",
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["evidence"]);
  });

  it("requires source and context on an outcome metric", async () => {
    const findings = await validateObject("outcomeMetric", {
      value: "42%",
      descriptor: "Example measure (fixture)",
      evidence: evidencePending(),
    });
    expect(
      errorsOf(findings)
        .map((f) => f.path)
        .sort(),
    ).toEqual(["context", "source"]);
    expect(
      await validateObject("outcomeMetric", {
        value: "42%",
        descriptor: "Example measure (fixture)",
        source: "Example source (fixture)",
        context: "Example context (fixture)",
        evidence: evidencePending(),
      }),
    ).toEqual([]);
  });

  it("requires verified permission evidence once permission is granted", async () => {
    const base = {
      quote: "Example quote (fixture)",
      attribution: "A. Person (fixture)",
      permissionStatus: "granted",
    };
    expect(errorsOf(await validateObject("testimonial", base))).toHaveLength(1);
    expect(
      await validateObject("testimonial", { ...base, permissionEvidence: evidenceVerified() }),
    ).toEqual([]);
    expect(await validateObject("testimonial", { ...base, permissionStatus: "pending" })).toEqual(
      [],
    );
  });

  it("requires an attribution", async () => {
    const findings = await validateObject("testimonial", {
      quote: "Example quote (fixture)",
      permissionStatus: "pending",
    });
    expect(errorsOf(findings).map((f) => f.path)).toEqual(["attribution"]);
  });
});
