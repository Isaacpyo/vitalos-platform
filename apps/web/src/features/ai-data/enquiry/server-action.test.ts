import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "@vitalos/config";
import { createEnquiryService, getMemoryBackendForTests } from "../../enquiries/composition";
import type { EnquiryService } from "../../enquiries/composition";
import { notificationHeaders } from "../../enquiries/adapters/email-notifier";
import type { NotificationMessage, Notifier } from "../../enquiries/domain/ports";
import { recordingLogger } from "../../enquiries/test-support";

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

const { submitAiDataEnquiryAction } = await import("./server-action");
const { initialAiDataFormState } = await import("./form-state");

interface EnvOptions {
  backend?: "memory" | "disabled";
  privacyNoticeVersion?: string;
  turnstileSecret?: string;
}

const env = ({ backend = "memory", privacyNoticeVersion, turnstileSecret }: EnvOptions = {}): Env =>
  ({
    deployEnv: "local",
    siteUrl: "https://www.example.invalid",
    supabase: {},
    turnstile: turnstileSecret ? { secretKey: turnstileSecret } : {},
    enquiry: { backend, ipHashSalt: "fixture-salt-0123456789", privacyNoticeVersion },
    email: { provider: "console" },
  }) as unknown as Env;

const fields = (overrides: Record<string, string | undefined> = {}): Record<string, string> => {
  const base: Record<string, string | undefined> = {
    name: "Example Person (fixture)",
    workEmail: "person@example.invalid",
    organisation: "Example Practice (fixture)",
    role: "Practice owner",
    sector: "accounting-bookkeeping",
    problem: "We re-key supplier statements into the ledger by hand every month.",
    currentProcess: "PDF statements, Excel and Xero.",
    desiredOutcome: "Statements reconciled with a list of exceptions.",
    offer: "ai-proof-of-value",
    timeframe: "within-3-months",
    budget: "1k-5k",
    privacyNoticeVersion: "fixture-1",
    idempotencyKey: crypto.randomUUID(),
    consent: "on",
    website: "",
    utm_source: "newsletter",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(base).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
};

function form(values: Record<string, string> = fields()): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  data.set("$ACTION_ID_fixture", "x");
  return data;
}

const submit = (data: FormData) =>
  submitAiDataEnquiryAction(initialAiDataFormState, data).then(
    (result) => ({ result, redirectedTo: undefined as string | undefined }),
    (error: unknown) => ({ result: undefined, redirectedTo: (error as { url?: string }).url }),
  );

let sent: NotificationMessage[];
const capturingNotifier: Notifier = {
  send: (message) => {
    sent.push(message);
    return Promise.resolve();
  },
};

beforeEach(() => {
  state.afterTasks.length = 0;
  sent = [];
  const backend = getMemoryBackendForTests();
  backend.repository.enquiries.clear();
  backend.repository.outbox.length = 0;
  backend.limiter.reset();
  state.service = createEnquiryService(env(), {
    logger: recordingLogger(),
    notifier: capturingNotifier,
  });
});

const stored = () => [...getMemoryBackendForTests().repository.enquiries.values()];

describe("submitAiDataEnquiryAction", () => {
  it("accepted: stores an `ai` enquiry from /ai-data/contact, then redirects with the reference", async () => {
    const { redirectedTo } = await submit(form());
    expect(redirectedTo).toMatch(/^\/ai-data\/contact\/thank-you\?ref=VIT-[0-9A-F]{12}$/);
    const [enquiry] = stored();
    expect(stored()).toHaveLength(1);
    expect(enquiry).toMatchObject({
      intent: "ai",
      sourcePath: "/ai-data/contact",
      offerSlug: "ai-proof-of-value",
      name: "Example Person (fixture)",
      role: "Practice owner",
      timeframe: "within-3-months",
      utm: { source: "newsletter" },
    });
    expect(enquiry?.goal).toBe(
      [
        "Vitalos AI & Data enquiry",
        "Sector: Accounting and bookkeeping",
        "Business problem or workflow:",
        "We re-key supplier statements into the ledger by hand every month.",
        "Current tools and process:",
        "PDF statements, Excel and Xero.",
        "Desired outcome:",
        "Statements reconciled with a list of exceptions.",
        "Indicative budget: £1,000–£5,000 (enquirer's estimate)",
      ].join("\n"),
    );
    expect(redirectedTo).toContain(enquiry?.reference);
  });

  it("persists first, notifies after: the outbox dispatch sends the AI & Data headers", async () => {
    await submit(form());
    expect(sent).toHaveLength(0);
    expect(state.afterTasks).toHaveLength(1);
    await Promise.all(state.afterTasks.map((task) => task()));
    expect(sent).toHaveLength(1);
    const headers = notificationHeaders(sent[0]!.enquiry);
    expect(headers["X-Vitalos-Pipeline"]).toBe("ai-data");
    expect(headers["X-Vitalos-Offer"]).toBe("ai-proof-of-value");
  });

  it("'Not sure yet' records no offer slug", async () => {
    await submit(form(fields({ offer: "not-sure" })));
    expect(stored()[0]?.offerSlug).toBeUndefined();
  });

  it("duplicate: a replayed idempotency key returns the original reference, nothing new stored", async () => {
    const values = fields();
    const first = await submit(form(values));
    const second = await submit(form(values));
    expect(second.redirectedTo).toBe(first.redirectedTo);
    expect(stored()).toHaveLength(1);
  });

  it("invalid: AI & Data field errors and the submitted values (never the token) come back", async () => {
    const data = form(fields({ problem: "short", sector: "banking", desiredOutcome: undefined }));
    data.set("cf-turnstile-response", "secret-token");
    const { result } = await submit(data);
    expect(result?.status).toBe("invalid");
    if (result?.status !== "invalid") return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(["desiredOutcome", "problem", "sector"]);
    expect(result.values).toMatchObject({ problem: "short", sector: "banking", budget: "1k-5k" });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(result.message).toMatch(/highlighted fields/);
    expect(stored()).toHaveLength(0);
    expect(state.afterTasks).toHaveLength(0);
  });

  it("invalid: missing consent is a field error on `consent`", async () => {
    const values = fields();
    delete values.consent;
    const { result } = await submit(form(values));
    expect(result?.status === "invalid" && result.fieldErrors.consent).toBeTruthy();
  });

  it("invalid from the service: a stale privacy notice maps back to `consent`", async () => {
    state.service = createEnquiryService(env({ privacyNoticeVersion: "fixture-2" }), {
      logger: recordingLogger(),
    });
    const { result } = await submit(form());
    expect(result?.status).toBe("invalid");
    if (result?.status !== "invalid") return;
    expect(result.fieldErrors.consent).toMatch(/privacy notice has changed/);
    expect(result.values.problem).toBe(fields().problem);
  });

  it("rejected: a filled honeypot is rejected and logged by the service, never echoed", async () => {
    const logger = recordingLogger();
    state.service = createEnquiryService(env(), { logger });
    const { result } = await submit(form(fields({ website: "https://spam.invalid" })));
    expect(result?.status).toBe("rejected");
    expect(JSON.stringify(result)).not.toContain("spam.invalid");
    expect(logger.lines).toContainEqual(
      expect.objectContaining({
        event: "enquiry.rejected",
        fields: expect.objectContaining({ reason: "honeypot" }),
      }),
    );
    expect(stored()).toHaveLength(0);
  });

  it("rejected: the human check failed; values are kept for another try", async () => {
    const failing = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 200 })),
    );
    state.service = createEnquiryService(env({ turnstileSecret: "fixture-secret" }), {
      logger: recordingLogger(),
      fetch: failing,
    });
    const data = form();
    data.set("cf-turnstile-response", "fixture-token");
    const { result } = await submit(data);
    expect(failing).toHaveBeenCalled();
    expect(result?.status).toBe("rejected");
    if (result?.status !== "rejected") return;
    expect(result.message).toMatch(/could not verify/);
    expect(result.values.organisation).toBe("Example Practice (fixture)");
    expect(stored()).toHaveLength(0);
  });

  it("rate-limited: a human message and retryAfterSeconds, values kept", async () => {
    let last: Awaited<ReturnType<typeof submit>> | undefined;
    for (let i = 0; i < 11; i += 1) last = await submit(form());
    expect(last?.result?.status).toBe("rate-limited");
    if (last?.result?.status !== "rate-limited") return;
    expect(last.result.retryAfterSeconds).toBeGreaterThan(0);
    expect(last.result.message).toMatch(/try again in/);
    expect(last.result.values.desiredOutcome).toBe(fields().desiredOutcome);
  });

  it("unavailable: honest state when no backend is configured, values kept", async () => {
    state.service = createEnquiryService(env({ backend: "disabled" }));
    const { result } = await submit(form());
    expect(result?.status).toBe("unavailable");
    if (result?.status !== "unavailable") return;
    expect(result.values.name).toBe("Example Person (fixture)");
  });

  it("unavailable: a thrown dependency never escapes as an error", async () => {
    state.service = {
      available: true,
      receive: () => Promise.reject(new Error("boom")),
      dispatch: () => Promise.resolve(null),
      purgeExpired: () => Promise.reject(new Error("unused")),
    } satisfies EnquiryService;
    const { result } = await submit(form());
    expect(result?.status).toBe("unavailable");
  });
});
