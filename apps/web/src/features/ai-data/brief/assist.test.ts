import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { RateLimiter } from "@vitalos/security/rate-limit";
import { verifyRequest } from "../../content/signing";
import { ASSIST_PATH, createBriefAssistClient } from "./assist-client";
import { draftBrief, suggestQuestions, visitorRef } from "./assist-service";
import type { AssistServiceDeps } from "./assist-service";

const key = { id: "web-read", secret: "s".repeat(40) };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const questionsBody = {
  mode: "ai",
  questions: [
    {
      id: "q1",
      question: "Which tools?",
      why: "Shapes scope",
      suggestions: ["Excel", "Xero", "a", "b", "c"],
    },
    { id: "q2", question: "How often?" },
  ],
};
const briefBody = {
  mode: "ai",
  brief: {
    current_workflow: "Matched by hand",
    desired_outcome: "Fewer errors",
    possible_automation: ["Read statements"],
    unknowns: ["Systems"],
    suggested_next_step: "A conversation",
  },
};

const request = {
  description: "Supplier statements are matched by hand every month.",
  topic: null,
  answers: [],
  visitorRef: "a".repeat(64),
};

describe("assist client", () => {
  it("signs the POST with scheme v1, scope assist and the read key", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => json(200, questionsBody));
    const client = createBriefAssistClient({
      baseUrl: "https://admin.example.invalid/",
      key,
      fetch: fetchMock as unknown as typeof fetch,
      now: () => 1_800_000_000,
    });
    const result = await client.questions(request);
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://admin.example.invalid${ASSIST_PATH}`);
    const headers = new Headers(init.headers);
    const body = String(init.body);
    expect(JSON.parse(body)).toMatchObject({
      version: 1,
      stage: "questions",
      visitor_ref: request.visitorRef,
    });
    expect(createHash("sha256").update(body).digest("hex")).toHaveLength(64);
    expect(
      verifyRequest({
        headers,
        keys: [key],
        scope: "assist",
        method: "POST",
        pathAndQuery: ASSIST_PATH,
        body,
        now: 1_800_000_000,
      }),
    ).toEqual({ ok: true, keyId: "web-read" });
    expect(headers.get("x-vitalos-signature")).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it("parses questions (limiting suggestions to four) and the brief", async () => {
    const make = (body: unknown) =>
      createBriefAssistClient({
        baseUrl: "https://admin.example.invalid",
        key,
        fetch: (async () => json(200, body)) as unknown as typeof fetch,
      });
    const q = await make(questionsBody).questions(request);
    expect(q.ok && q.data[0]?.suggestions).toHaveLength(4);
    expect(q.ok && q.data[1]).toMatchObject({ id: "q2", why: "", suggestions: [] });
    const b = await make(briefBody).brief(request);
    expect(b).toEqual({
      ok: true,
      data: {
        currentWorkflow: "Matched by hand",
        desiredOutcome: "Fewer errors",
        possibleAutomation: ["Read statements"],
        unknowns: ["Systems"],
        suggestedNextStep: "A conversation",
      },
    });
  });

  it.each([
    [429, "rate-limited"],
    [503, "unavailable"],
    [401, "invalid"],
    [400, "invalid"],
    [500, "invalid"],
  ])("maps HTTP %i to %s", async (status, reason) => {
    const client = createBriefAssistClient({
      baseUrl: "https://admin.example.invalid",
      key,
      fetch: (async () => json(status, { error: "x" })) as unknown as typeof fetch,
    });
    expect(await client.brief(request)).toEqual({ ok: false, reason });
  });

  it("treats invalid payloads as unavailable", async () => {
    const make = (response: () => Response) =>
      createBriefAssistClient({
        baseUrl: "https://admin.example.invalid",
        key,
        fetch: (async () => response()) as unknown as typeof fetch,
      });
    expect(
      await make(() =>
        json(200, { mode: "ai", questions: [questionsBody.questions[0]] }),
      ).questions(request),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(await make(() => json(200, { mode: "other", brief: {} })).brief(request)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await make(() => new Response("not json", { status: 200 })).brief(request)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("times out after the configured time and on network errors", async () => {
    const slow = createBriefAssistClient({
      baseUrl: "https://admin.example.invalid",
      key,
      timeoutMs: 20,
      fetch: ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })) as unknown as typeof fetch,
    });
    expect(await slow.questions(request)).toEqual({ ok: false, reason: "timeout" });
    const down = createBriefAssistClient({
      baseUrl: "https://admin.example.invalid",
      key,
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    expect(await down.questions(request)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("assist service", () => {
  const allow: RateLimiter = { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }) };
  const valid = {
    stage: "questions" as const,
    aiConsent: true as const,
    description: request.description,
    topic: null,
    answers: [],
  };
  const fakeClient = () => ({
    questions: vi.fn(async (_request: unknown) => ({ ok: true as const, data: [] })),
    brief: vi.fn(async (_request: unknown) => ({
      ok: false as const,
      reason: "unavailable" as const,
    })),
  });
  const deps = (over: Partial<AssistServiceDeps> = {}): AssistServiceDeps => ({
    client: fakeClient(),
    limiter: allow,
    salt: "e2e-only-ip-hash-salt-not-a-secret",
    ip: "203.0.113.9",
    ...over,
  });

  it("is unavailable when not configured, without calling anything", async () => {
    expect(await suggestQuestions(valid, deps({ client: null }))).toEqual({
      source: "unavailable",
      reason: "not-configured",
    });
    expect(await suggestQuestions(valid, deps({ salt: undefined }))).toEqual({
      source: "unavailable",
      reason: "not-configured",
    });
  });

  it("refuses without the explicit opt-in and with invalid input, before any call", async () => {
    const client = fakeClient();
    const d = deps({ client });
    expect(await suggestQuestions({ ...valid, aiConsent: false }, d)).toEqual({
      source: "unavailable",
      reason: "invalid",
    });
    expect(await suggestQuestions({ ...valid, description: "short" }, d)).toEqual({
      source: "unavailable",
      reason: "invalid",
    });
    expect(await suggestQuestions({ ...valid, description: "x".repeat(1501) }, d)).toEqual({
      source: "unavailable",
      reason: "invalid",
    });
    expect(await suggestQuestions({ ...valid, topic: "made-up" }, d)).toEqual({
      source: "unavailable",
      reason: "invalid",
    });
    expect(client.questions).not.toHaveBeenCalled();
  });

  it("returns AI output and passes an HMAC visitor_ref, never the raw IP", async () => {
    const client = fakeClient();
    const result = await suggestQuestions(valid, deps({ client }));
    expect(result).toEqual({ source: "ai", data: [] });
    const sent = (client.questions.mock.calls[0] as unknown as [{ visitorRef: string }])[0];
    expect(sent.visitorRef).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(sent)).not.toContain("203.0.113.9");
    expect(sent.visitorRef).toBe(
      await visitorRef("203.0.113.9", "e2e-only-ip-hash-salt-not-a-secret"),
    );
  });

  it("passes failures through honestly and applies the per-IP limit", async () => {
    const result = await draftBrief({ ...valid, stage: "brief" }, deps());
    expect(result).toEqual({ source: "unavailable", reason: "unavailable" });
    const limited = await suggestQuestions(
      valid,
      deps({ limiter: { consume: async () => ({ allowed: false, retryAfterSeconds: 30 }) } }),
    );
    expect(limited).toEqual({ source: "unavailable", reason: "busy" });
  });
});
