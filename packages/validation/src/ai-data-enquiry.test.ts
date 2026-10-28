import { describe, expect, it } from "vitest";
import {
  AI_DATA_OUTCOME_MAX,
  AI_DATA_PROBLEM_MAX,
  AI_DATA_PROCESS_MAX,
  AI_DATA_SOURCE_PATH,
  aiDataBudgetBands,
  aiDataBudgetLabels,
  aiDataEnquiryInputFromForm,
  aiDataEnquirySchema,
  aiDataOffers,
  aiDataSectorLabels,
  aiDataSectors,
  composeAiDataGoal,
  summariseAiDataIssues,
  toEnquiryInputV2,
} from "./ai-data-enquiry";
import type { AiDataEnquiryInput } from "./ai-data-enquiry";
import { GOAL_MAX, codePointLength, enquirySchemaV2 } from "./enquiry";

const valid = {
  name: "Example Person",
  workEmail: "person@example.invalid",
  organisation: "Example Practice (fixture)",
  sector: "accounting-bookkeeping",
  problem: "We re-key supplier statements into the ledger by hand every month.",
  desiredOutcome: "Statements reconciled in minutes, with exceptions listed.",
  timeframe: "within-3-months",
  consent: true,
  privacyNoticeVersion: "fixture-1",
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
};

const parse = (body: unknown): AiDataEnquiryInput => aiDataEnquirySchema.parse(body);

const issuesFor = (body: unknown) => {
  const result = aiDataEnquirySchema.safeParse(body);
  if (result.success) throw new Error("expected failure");
  return summariseAiDataIssues(result.error);
};

describe("aiDataEnquirySchema", () => {
  it("accepts a minimal valid enquiry and every optional field", () => {
    expect(aiDataEnquirySchema.safeParse(valid).success).toBe(true);
    const full = aiDataEnquirySchema.safeParse({
      ...valid,
      role: "Practice owner",
      currentProcess: "Excel and Xero.",
      offer: "ai-proof-of-value",
      budget: "1k-5k",
      utm: { source: "newsletter" },
      turnstileToken: "token",
      website: "",
    });
    expect(full.success).toBe(true);
  });

  it("is strict: unknown keys are flagged, not turned into field errors", () => {
    const summary = issuesFor({ ...valid, intent: "ai", isAdmin: true });
    expect(summary.unknownKeys).toBe(true);
    expect(summary.fieldErrors).toEqual({});
  });

  it("flags a filled honeypot as abuse", () => {
    const summary = issuesFor({ ...valid, website: "https://spam.invalid" });
    expect(summary.honeypotTripped).toBe(true);
    expect(summary.fieldErrors).toEqual({});
  });

  it("measures the problem in code points: 20 to 2000", () => {
    expect(issuesFor({ ...valid, problem: "   too short   " }).fieldErrors.problem).toMatch(
      /at least 20/,
    );
    expect(
      issuesFor({ ...valid, problem: "x".repeat(AI_DATA_PROBLEM_MAX + 1) }).fieldErrors.problem,
    ).toMatch(/2000 characters or fewer/);
    // An emoji is two UTF-16 units but one code point (what PostgreSQL counts).
    expect(
      aiDataEnquirySchema.safeParse({ ...valid, problem: "😀".repeat(AI_DATA_PROBLEM_MAX) })
        .success,
    ).toBe(true);
  });

  it("bounds the current process (optional, ≤1200) and the desired outcome (10 to 1000)", () => {
    expect(
      issuesFor({ ...valid, currentProcess: "x".repeat(AI_DATA_PROCESS_MAX + 1) }).fieldErrors
        .currentProcess,
    ).toMatch(/1200/);
    expect(issuesFor({ ...valid, desiredOutcome: "faster" }).fieldErrors.desiredOutcome).toMatch(
      /at least 10/,
    );
    expect(
      issuesFor({ ...valid, desiredOutcome: "x".repeat(AI_DATA_OUTCOME_MAX + 1) }).fieldErrors
        .desiredOutcome,
    ).toMatch(/1000/);
    const { desiredOutcome: _omit, ...withoutOutcome } = valid;
    void _omit;
    expect(issuesFor(withoutOutcome).fieldErrors.desiredOutcome).toBe(
      "Describe the outcome you want.",
    );
  });

  it("allows line breaks in free text but refuses other control characters", () => {
    expect(
      aiDataEnquirySchema.safeParse({ ...valid, problem: `${valid.problem}\r\nSecond line.` })
        .success,
    ).toBe(true);
    expect(issuesFor({ ...valid, problem: `${valid.problem}\u0000` }).fieldErrors.problem).toBe(
      "Remove control characters.",
    );
  });

  it("keeps the main contract's single-line rules for name, organisation and role", () => {
    expect(issuesFor({ ...valid, name: "Example\nPerson" }).fieldErrors.name).toBe(
      "Use a single line without control characters.",
    );
    expect(issuesFor({ ...valid, role: "Owner\r\nBcc: x" }).fieldErrors.role).toBe(
      "Use a single line without control characters.",
    );
    expect(issuesFor({ ...valid, organisation: "Org\u0007" }).fieldErrors.organisation).toBe(
      "Use a single line without control characters.",
    );
  });

  it("accepts exactly the PLAN.md sector, offer and budget keys", () => {
    expect(aiDataSectors).toEqual([
      "accounting-bookkeeping",
      "property",
      "automotive",
      "professional-services",
      "trades-field-services",
      "retail-ecommerce",
      "other",
    ]);
    expect(aiDataOffers).toEqual([
      "ai-opportunity-assessment",
      "ai-proof-of-value",
      "production-ai-engineering",
      "managed-ai-operations",
    ]);
    expect(aiDataBudgetBands).toEqual(["under-1k", "1k-5k", "5k-15k", "over-15k", "not-sure"]);
    expect(aiDataBudgetLabels).toEqual({
      "under-1k": "Under £1,000",
      "1k-5k": "£1,000–£5,000",
      "5k-15k": "£5,000–£15,000",
      "over-15k": "Over £15,000",
      "not-sure": "Not sure yet",
    });
    for (const sector of aiDataSectors) {
      expect(aiDataEnquirySchema.safeParse({ ...valid, sector }).success).toBe(true);
    }
    expect(issuesFor({ ...valid, sector: "banking" }).fieldErrors.sector).toMatch(/sector/);
    expect(issuesFor({ ...valid, budget: "1000000" }).fieldErrors.budget).toMatch(/budget band/);
    expect(issuesFor({ ...valid, offer: "free-lunch" }).fieldErrors.offer).toMatch(/offers/);
    expect(aiDataEnquirySchema.safeParse({ ...valid, offer: "not-sure" }).success).toBe(true);
  });

  it("never echoes a submitted value in an error message", () => {
    const marker = "MARKER-VALUE-42";
    const summary = issuesFor({
      ...valid,
      sector: marker,
      budget: marker,
      offer: marker,
      workEmail: marker,
      name: `${marker}\n`,
    });
    expect(JSON.stringify(summary)).not.toContain(marker);
  });
});

describe("aiDataEnquiryInputFromForm", () => {
  it("reads known fields only, blanks become undefined, consent becomes true", () => {
    const form = new URLSearchParams({
      name: "Example Person",
      workEmail: "person@example.invalid",
      organisation: "Example Practice (fixture)",
      role: "",
      sector: "property",
      problem: valid.problem,
      currentProcess: "   ",
      desiredOutcome: valid.desiredOutcome,
      offer: "",
      timeframe: "exploring",
      budget: "",
      consent: "on",
      privacyNoticeVersion: "fixture-1",
      idempotencyKey: valid.idempotencyKey,
      website: "",
      "cf-turnstile-response": "token",
      utm_source: "newsletter",
      $ACTION_ID_abc: "x",
      intent: "careers",
    });
    const body = aiDataEnquiryInputFromForm(form);
    expect(body).not.toHaveProperty("$ACTION_ID_abc");
    expect(body).not.toHaveProperty("intent");
    expect(body.role).toBeUndefined();
    expect(body.currentProcess).toBeUndefined();
    expect(body.consent).toBe(true);
    expect(body.turnstileToken).toBe("token");
    expect(body.utm).toEqual({ source: "newsletter" });
    expect(aiDataEnquirySchema.safeParse(body).success).toBe(true);
  });
});

describe("composeAiDataGoal", () => {
  it("follows the PLAN.md template exactly", () => {
    const goal = composeAiDataGoal(
      parse({ ...valid, currentProcess: "Excel and Xero.", budget: "5k-15k" }),
    );
    expect(goal).toBe(
      [
        "Vitalos AI & Data enquiry",
        "Sector: Accounting and bookkeeping",
        "Business problem or workflow:",
        valid.problem,
        "Current tools and process:",
        "Excel and Xero.",
        "Desired outcome:",
        valid.desiredOutcome,
        "Indicative budget: £5,000–£15,000 (enquirer's estimate)",
      ].join("\n"),
    );
  });

  it("says 'Not given' for blank optional answers", () => {
    const goal = composeAiDataGoal(parse(valid));
    expect(goal).toContain("Current tools and process:\nNot given\n");
    expect(goal).toMatch(/Indicative budget: Not given \(enquirer's estimate\)$/);
  });

  it("labels every sector", () => {
    for (const sector of aiDataSectors) {
      expect(composeAiDataGoal(parse({ ...valid, sector }))).toContain(
        `Sector: ${aiDataSectorLabels[sector]}\n`,
      );
    }
  });

  it("stays within GOAL_MAX with every field at its maximum (code points)", () => {
    const goal = composeAiDataGoal(
      parse({
        ...valid,
        sector: "trades-field-services",
        problem: "😀".repeat(AI_DATA_PROBLEM_MAX),
        currentProcess: "😀".repeat(AI_DATA_PROCESS_MAX),
        desiredOutcome: "😀".repeat(AI_DATA_OUTCOME_MAX),
        budget: "5k-15k",
      }),
    );
    expect(codePointLength(goal)).toBeLessThanOrEqual(GOAL_MAX);
  });
});

describe("toEnquiryInputV2", () => {
  it("builds a v2 body that the enquiry contract accepts, with intent ai and the source path", () => {
    const body = toEnquiryInputV2(
      parse({
        ...valid,
        role: "Owner",
        offer: "ai-opportunity-assessment",
        budget: "under-1k",
        utm: { campaign: "launch" },
        turnstileToken: "token",
      }),
    );
    expect(body).toMatchObject({
      intent: "ai",
      sourcePath: AI_DATA_SOURCE_PATH,
      offerSlug: "ai-opportunity-assessment",
      role: "Owner",
      utm: { campaign: "launch" },
      turnstileToken: "token",
      consent: true,
    });
    expect(body).not.toHaveProperty("budgetRange");
    expect(enquirySchemaV2.safeParse(body).success).toBe(true);
  });

  it("records no offer slug for 'Not sure yet' or no choice", () => {
    expect(toEnquiryInputV2(parse({ ...valid, offer: "not-sure" }))).not.toHaveProperty(
      "offerSlug",
    );
    expect(toEnquiryInputV2(parse(valid))).not.toHaveProperty("offerSlug");
  });
});
