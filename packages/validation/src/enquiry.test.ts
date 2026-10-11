import { describe, expect, it } from "vitest";
import {
  createEnquirySchemaV2,
  enquiryInputFromForm,
  enquirySchemaV2,
  summariseEnquiryIssues,
} from "./enquiry";

const valid = {
  name: "Example Person",
  organisation: "Example Organisation (fixture)",
  workEmail: "person@example.invalid",
  goal: "Clearly artificial non-production enquiry fixture used by tests.",
  timeframe: "within-3-months",
  intent: "project",
  sourcePath: "/contact",
  consent: true,
  privacyNoticeVersion: "fixture-1",
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
};

const issuesFor = (body: unknown) => {
  const result = enquirySchemaV2.safeParse(body);
  if (result.success) throw new Error("expected failure");
  return summariseEnquiryIssues(result.error);
};

describe("enquirySchemaV2", () => {
  it("accepts a minimal valid enquiry", () => {
    expect(enquirySchemaV2.safeParse(valid).success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const parsed = enquirySchemaV2.safeParse({
      ...valid,
      role: "Fixture role",
      offerSlug: "example-offer",
      utm: { source: "newsletter", campaign: "q1" },
      turnstileToken: "token",
      website: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("trims text and rejects goals under 20 or over 5000 characters", () => {
    expect(issuesFor({ ...valid, goal: "  too short  " }).fieldErrors.goal).toMatch(/at least 20/);
    expect(issuesFor({ ...valid, goal: "x".repeat(5001) }).fieldErrors.goal).toMatch(/5000/);
    expect(enquirySchemaV2.safeParse({ ...valid, goal: "x".repeat(5000) }).success).toBe(true);
  });

  it("rejects unknown keys without turning them into field errors", () => {
    const summary = issuesFor({ ...valid, isAdmin: true });
    expect(summary.unknownKeys).toBe(true);
    expect(summary.fieldErrors).toEqual({});
  });

  it("flags a filled honeypot as abuse, not as a field error", () => {
    const summary = issuesFor({ ...valid, website: "https://spam.invalid" });
    expect(summary.honeypotTripped).toBe(true);
    expect(summary.fieldErrors).toEqual({});
  });

  it("requires consent to be exactly true", () => {
    expect(issuesFor({ ...valid, consent: false }).fieldErrors.consent).toBeDefined();
    expect(issuesFor({ ...valid, consent: "true" }).fieldErrors.consent).toBeDefined();
  });

  it("rejects malformed email, timeframe, intent and idempotency key", () => {
    const { fieldErrors } = issuesFor({
      ...valid,
      workEmail: "not-an-email",
      timeframe: "tomorrow",
      intent: "spam",
      idempotencyKey: "abc",
    });
    expect(Object.keys(fieldErrors).sort()).toEqual([
      "idempotencyKey",
      "intent",
      "timeframe",
      "workEmail",
    ]);
  });

  it.each(["//evil.invalid", "https://evil.invalid/", "/a\\b", "/a\tb", "contact"])(
    "rejects source path %j",
    (sourcePath) => {
      expect(issuesFor({ ...valid, sourcePath }).fieldErrors.sourcePath).toBeDefined();
    },
  );

  it.each(["/contact?x=1", "/contact#top", "/a?b"])(
    "rejects a source path with a query or fragment: %j",
    (sourcePath) => {
      expect(issuesFor({ ...valid, sourcePath }).fieldErrors.sourcePath).toBeDefined();
    },
  );

  describe("input PostgreSQL cannot store is a validation error (400), never a 503", () => {
    it("rejects NUL anywhere in stored text", () => {
      for (const field of ["name", "organisation", "role", "goal"] as const) {
        const value = field === "goal" ? `${valid.goal}\u0000` : "Example\u0000Value";
        expect(issuesFor({ ...valid, [field]: value }).fieldErrors[field]).toBeDefined();
      }
    });

    it("rejects ill-formed Unicode (lone surrogates)", () => {
      for (const field of ["name", "organisation", "role", "goal"] as const) {
        const value = field === "goal" ? `${valid.goal}\ud800` : "Example\udc00 Value";
        expect(issuesFor({ ...valid, [field]: value }).fieldErrors[field]).toBeDefined();
      }
      expect(issuesFor({ ...valid, utm: { source: "a\ud800" } }).fieldErrors.utm).toBeDefined();
      expect(issuesFor({ ...valid, sourcePath: "/a\ud800" }).fieldErrors.sourcePath).toBeDefined();
    });

    it("measures length in code points like char_length()", () => {
      // 20 astral characters: 40 UTF-16 units but 20 code points, so the goal minimum is met.
      expect(enquirySchemaV2.safeParse({ ...valid, goal: "\u{1F600}".repeat(20) }).success).toBe(
        true,
      );
      expect(issuesFor({ ...valid, goal: "\u{1F600}".repeat(19) }).fieldErrors.goal).toBeDefined();
      // 120 astral characters fit a 120 code point name; 121 do not.
      expect(enquirySchemaV2.safeParse({ ...valid, name: "\u{1F600}".repeat(120) }).success).toBe(
        true,
      );
      expect(issuesFor({ ...valid, name: "\u{1F600}".repeat(121) }).fieldErrors.name).toBeDefined();
    });

    it("bounds the utm payload by UTF-8 bytes, under the database cap", () => {
      const wide = "\u{1F600}".repeat(100); // 100 code points, 400 bytes
      const utm = { source: wide, medium: wide, campaign: wide, term: wide, content: wide };
      expect(issuesFor({ ...valid, utm }).fieldErrors.utm).toBeDefined();
    });
  });

  it("rejects CR and LF (header injection) in one-line fields but allows newlines in the goal", () => {
    for (const field of ["name", "organisation", "role"] as const) {
      expect(
        issuesFor({ ...valid, [field]: "Example\r\nBcc: x" }).fieldErrors[field],
      ).toBeDefined();
    }
    expect(
      enquirySchemaV2.safeParse({ ...valid, goal: `${valid.goal}\nSecond line.\r\nThird.` })
        .success,
    ).toBe(true);
    expect(issuesFor({ ...valid, goal: `${valid.goal}\u0007` }).fieldErrors.goal).toBeDefined();
  });

  it("bounds utm values and rejects unknown utm keys", () => {
    expect(issuesFor({ ...valid, utm: { source: "x".repeat(101) } }).fieldErrors.utm).toBeDefined();
    expect(issuesFor({ ...valid, utm: { sneaky: "x" } }).fieldErrors.utm).toBeDefined();
  });

  it("never echoes the submitted value in an error message", () => {
    const { fieldErrors } = issuesFor({ ...valid, workEmail: "secret-value@" });
    expect(JSON.stringify(fieldErrors)).not.toContain("secret-value");
  });

  describe("budgetRange flag", () => {
    it("is not accepted while no bands are approved", () => {
      expect(
        issuesFor({ ...valid, budgetRange: "anything" }).fieldErrors.budgetRange,
      ).toBeDefined();
    });
    it("accepts only approved bands once the owner supplies them", () => {
      const schema = createEnquirySchemaV2({ budgetBands: ["band-a"] });
      expect(schema.safeParse({ ...valid, budgetRange: "band-a" }).success).toBe(true);
      expect(schema.safeParse({ ...valid, budgetRange: "band-b" }).success).toBe(false);
    });
  });
});

describe("enquiryInputFromForm", () => {
  it("maps form fields, drops framework fields and converts the consent checkbox", () => {
    const form = new FormData();
    form.set("$ACTION_ID_abc", "x");
    for (const [key, value] of Object.entries({
      name: "Example Person",
      organisation: "Example Organisation (fixture)",
      workEmail: "person@example.invalid",
      role: "",
      goal: valid.goal,
      timeframe: "exploring",
      intent: "offer",
      offerSlug: "example-offer",
      sourcePath: "/offers/example-offer",
      consent: "on",
      privacyNoticeVersion: "fixture-1",
      idempotencyKey: valid.idempotencyKey,
      utm_source: "newsletter",
      "cf-turnstile-response": "tok",
      website: "",
    })) {
      form.set(key, value);
    }
    const input = enquiryInputFromForm(form);
    expect(input).not.toHaveProperty("$ACTION_ID_abc");
    expect(input.role).toBeUndefined();
    expect(input.consent).toBe(true);
    expect(input.utm).toEqual({ source: "newsletter" });
    expect(input.turnstileToken).toBe("tok");
    expect(enquirySchemaV2.safeParse(input).success).toBe(true);
  });

  it("leaves consent unset when the checkbox is absent", () => {
    expect(enquiryInputFromForm(new FormData()).consent).toBeUndefined();
  });

  it("passes a filled honeypot through so the schema can flag it", () => {
    const form = new FormData();
    form.set("website", "https://spam.invalid");
    expect(enquiryInputFromForm(form).website).toBe("https://spam.invalid");
  });
});
