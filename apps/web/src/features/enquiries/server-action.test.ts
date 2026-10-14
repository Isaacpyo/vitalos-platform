import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "@vitalos/config";
import { createEnquiryService, getMemoryBackendForTests } from "./composition";
import type { EnquiryService } from "./composition";
import { recordingLogger, validBody } from "./test-support";

const state = vi.hoisted(() => ({
  service: undefined as unknown,
  afterTasks: [] as (() => Promise<unknown>)[],
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.7" })),
}));
vi.mock("next/server", () => ({
  after: (task: () => Promise<unknown>) => {
    state.afterTasks.push(task);
  },
}));
vi.mock("./get-enquiry-service", () => ({
  getEnquiryService: () => state.service as EnquiryService,
}));

const { submitEnquiryAction } = await import("./server-action");
const { initialEnquiryFormState } = await import("./form-state");

const env = (backend: "memory" | "disabled"): Env =>
  ({
    deployEnv: "local",
    siteUrl: "https://www.example.invalid",
    supabase: {},
    turnstile: {},
    enquiry: { backend, ipHashSalt: "fixture-salt-0123456789" },
    email: { provider: "console" },
  }) as unknown as Env;

function form(body: Record<string, unknown>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (typeof value === "string") data.set(key, value);
  }
  data.set("consent", "on");
  data.set("website", "");
  data.set("$ACTION_ID_fixture", "x");
  return data;
}

beforeEach(() => {
  state.afterTasks.length = 0;
  const backend = getMemoryBackendForTests();
  backend.repository.enquiries.clear();
  backend.repository.outbox.length = 0;
  backend.limiter.reset();
  state.service = createEnquiryService(env("memory"), { logger: recordingLogger() });
});

describe("submitEnquiryAction", () => {
  it("accepted: returns the reference and schedules best-effort dispatch", async () => {
    const result = await submitEnquiryAction(initialEnquiryFormState, form(validBody()));
    expect(result).toMatchObject({
      status: "accepted",
      reference: expect.stringMatching(/^VIT-[0-9A-F]{12}$/),
    });
    expect(state.afterTasks).toHaveLength(1);
    expect(getMemoryBackendForTests().repository.enquiries.size).toBe(1);
  });

  it("invalid: returns field errors and the submitted values (never the token) for re-display", async () => {
    const data = form(validBody({ workEmail: "nope", goal: "short" }));
    data.set("cf-turnstile-response", "secret-token");
    const result = await submitEnquiryAction(initialEnquiryFormState, data);
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(["goal", "workEmail"]);
    expect(result.values).toMatchObject({
      name: "Example Person (fixture)",
      workEmail: "nope",
      goal: "short",
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(result.message).toMatch(/highlighted fields/);
  });

  it("invalid: missing consent is a field error on `consent`", async () => {
    const data = form(validBody());
    data.delete("consent");
    const result = await submitEnquiryAction(initialEnquiryFormState, data);
    expect(result.status === "invalid" && result.fieldErrors.consent).toBeTruthy();
  });

  it("rejected: honeypot", async () => {
    const data = form(validBody());
    data.set("website", "https://spam.invalid");
    expect((await submitEnquiryAction(initialEnquiryFormState, data)).status).toBe("rejected");
  });

  it("rate-limited: carries a human message and retryAfterSeconds", async () => {
    let result = await submitEnquiryAction(initialEnquiryFormState, form(validBody()));
    for (let i = 0; i < 10; i += 1) {
      result = await submitEnquiryAction(initialEnquiryFormState, form(validBody()));
    }
    expect(result.status).toBe("rate-limited");
    if (result.status === "rate-limited") {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.message).toMatch(/try again in/);
    }
  });

  it("unavailable: honest state when no backend is configured, values kept", async () => {
    state.service = createEnquiryService(env("disabled"));
    const result = await submitEnquiryAction(initialEnquiryFormState, form(validBody()));
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable")
      expect(result.values.name).toBe("Example Person (fixture)");
    expect(state.afterTasks).toHaveLength(0);
  });

  it("unavailable: an unexpected throw never escapes the action", async () => {
    state.service = {
      available: true,
      receive: () => Promise.reject(new Error("boom")),
      dispatch: () => Promise.resolve(null),
      purgeExpired: () => Promise.resolve({ purged: 0 }),
    };
    expect((await submitEnquiryAction(initialEnquiryFormState, form(validBody()))).status).toBe(
      "unavailable",
    );
  });
});
