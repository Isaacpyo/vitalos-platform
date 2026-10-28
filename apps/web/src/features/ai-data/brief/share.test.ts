import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "@vitalos/config";
import { createEnquiryService, getMemoryBackendForTests } from "../../enquiries/composition";
import type { EnquiryService } from "../../enquiries/composition";
import { notificationHeaders } from "../../enquiries/adapters/email-notifier";
import type { NotificationMessage, Notifier } from "../../enquiries/domain/ports";
import { recordingLogger } from "../../enquiries/test-support";
import { cardsFromDraft } from "./cards";
import { draftChecklistBrief, selectQuestions } from "./question-bank";
import { serialiseBrief } from "./serialise";

/**
 * A guided brief shared through the EXISTING enquiry action (W6): same validation, same pipeline
 * headers, one record per idempotency key. Mirrors superadmin/apps/aidata/intake.py's reading of
 * the composed goal.
 */

const state = vi.hoisted(() => ({
  service: undefined as unknown,
  afterTasks: [] as (() => Promise<unknown>)[],
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));
vi.mock("next/server", () => ({
  after: (task: () => Promise<unknown>) => {
    state.afterTasks.push(task);
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("../../enquiries/get-enquiry-service", () => ({
  getEnquiryService: () => state.service as EnquiryService,
}));

const { submitAiDataEnquiryAction } = await import("../enquiry/server-action");
const { initialAiDataFormState } = await import("../enquiry/form-state");

const env = {
  deployEnv: "local",
  siteUrl: "https://www.example.invalid",
  supabase: {},
  turnstile: {},
  enquiry: { backend: "memory", ipHashSalt: "fixture-salt-0123456789" },
  email: { provider: "console" },
} as unknown as Env;

const description = "Supplier statements are matched by hand every month.";
const questions = selectQuestions({ description, topic: "finance-reconciliation" });
const outcomeId = questions.find((q) => q.role === "outcome")?.id ?? "q1";
const answers = [
  { id: outcomeId, question: "What would a good result look like?", answer: "Fewer errors" },
];
const cards = cardsFromDraft(
  draftChecklistBrief({ description, topic: "finance-reconciliation", questions, answers }),
  "checklist",
);
const brief = serialiseBrief({
  description,
  answers,
  cards,
  questionsSource: "checklist",
  briefSource: "checklist",
});

function form(key: string): FormData {
  const data = new FormData();
  const values: Record<string, string> = {
    name: "Example Person (fixture)",
    workEmail: "person@example.invalid",
    organisation: "Example Practice (fixture)",
    sector: "accounting-bookkeeping",
    problem: brief.problem,
    currentProcess: brief.currentProcess ?? "",
    desiredOutcome: brief.desiredOutcome,
    offer: "ai-opportunity-assessment",
    timeframe: "exploring",
    privacyNoticeVersion: "fixture-1",
    idempotencyKey: key,
    consent: "on",
    website: "",
  };
  for (const [name, value] of Object.entries(values)) if (value) data.set(name, value);
  data.set("$ACTION_ID_fixture", "x");
  return data;
}

const submit = (data: FormData) =>
  submitAiDataEnquiryAction(initialAiDataFormState, data).then(
    () => ({ redirectedTo: undefined as string | undefined }),
    (error: unknown) => ({ redirectedTo: (error as { url?: string }).url }),
  );

let sent: NotificationMessage[];
const notifier: Notifier = {
  send: (message) => {
    sent.push(message);
    return Promise.resolve();
  },
};
const stored = () => [...getMemoryBackendForTests().repository.enquiries.values()];

beforeEach(() => {
  state.afterTasks.length = 0;
  sent = [];
  const backend = getMemoryBackendForTests();
  backend.repository.enquiries.clear();
  backend.repository.outbox.length = 0;
  backend.limiter.reset();
  state.service = createEnquiryService(env, { logger: recordingLogger(), notifier });
});

describe("sharing a guided brief through the enquiry action", () => {
  it("stores the marker, the sections and the offer interest in the enquiry message", async () => {
    const { redirectedTo } = await submit(form(crypto.randomUUID()));
    expect(redirectedTo).toMatch(/^\/ai-data\/contact\/thank-you\?ref=VIT-[0-9A-F]{12}$/);
    const [enquiry] = stored();
    expect(enquiry).toMatchObject({
      intent: "ai",
      sourcePath: "/ai-data/contact",
      offerSlug: "ai-opportunity-assessment",
    });
    const goal = enquiry?.goal ?? "";
    expect(goal.startsWith("Vitalos AI & Data enquiry\n")).toBe(true);
    expect(goal).toContain("[vitalos-brief v1 questions=checklist brief=checklist]");
    expect(goal).toContain("You said: Supplier statements are matched by hand");
    expect(goal).toContain("Possible automation (suggested from our checklist):");
    expect(goal).toContain("Current tools and process:");
    expect(goal).toContain("Desired outcome:\nFewer errors");
  });

  it("keeps the Super Admin intake headers", async () => {
    await submit(form(crypto.randomUUID()));
    await Promise.all(state.afterTasks.map((task) => task()));
    const headers = notificationHeaders(sent[0]!.enquiry);
    expect(headers["X-Vitalos-Pipeline"]).toBe("ai-data");
    expect(headers["X-Vitalos-Offer"]).toBe("ai-opportunity-assessment");
  });

  it("is idempotent: a double click or retry with the brief's key makes one record and one reference", async () => {
    const key = crypto.randomUUID();
    const results = await Promise.all([submit(form(key)), submit(form(key)), submit(form(key))]);
    expect(new Set(results.map((r) => r.redirectedTo)).size).toBe(1);
    expect(stored()).toHaveLength(1);
    // A different brief (start over) is a different key and a new enquiry.
    await submit(form(crypto.randomUUID()));
    expect(stored()).toHaveLength(2);
  });
});
