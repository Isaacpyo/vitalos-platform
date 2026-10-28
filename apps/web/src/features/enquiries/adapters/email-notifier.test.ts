import { describe, expect, it, vi } from "vitest";
import { NotificationError } from "../domain/ports";
import type { NotificationMessage } from "../domain/ports";
import { referenceFromId } from "../domain/enquiry";
import { piiMarkers, recordingLogger } from "../test-support";
import {
  PostmarkNotifier,
  ResendNotifier,
  classifyStatus,
  notificationHeaders,
} from "./email-notifier";

const API_KEY = "key-fixture-do-not-log-0123456789";
const id = "0f8fad5b-d9cb-469f-a165-70867728950e";

const message = (overrides: Partial<NotificationMessage["enquiry"]> = {}): NotificationMessage => ({
  kind: "internal-notification",
  idempotencyKey: `${id}:internal-notification`,
  correlationId: "corr-0001-fixture",
  enquiry: {
    id,
    reference: referenceFromId(id),
    name: "Example Person (fixture)",
    organisation: "Example Organisation (fixture)",
    workEmail: "person@example.invalid",
    role: "Fixture role",
    goal: "Clearly artificial non-production enquiry fixture used by automated tests.",
    timeframe: "within-3-months",
    budgetRange: undefined,
    intent: "project",
    offerSlug: undefined,
    sourcePath: "/contact",
    receivedAt: "2026-10-11T09:00:00.000Z",
    ...overrides,
  },
});

const respond = (status: number, body = '{"echo":"person@example.invalid"}') =>
  vi.fn<typeof fetch>(() => Promise.resolve(new Response(body, { status })));

const providers = [
  {
    name: "postmark",
    make: (fetchFake: typeof fetch, logger = recordingLogger(), timeoutMs?: number) =>
      new PostmarkNotifier({
        apiKey: API_KEY,
        from: "Vitalos <noreply@example.invalid>",
        to: "ops@example.invalid",
        logger,
        fetch: fetchFake,
        ...(timeoutMs ? { timeoutMs } : {}),
      }),
  },
  {
    name: "resend",
    make: (fetchFake: typeof fetch, logger = recordingLogger(), timeoutMs?: number) =>
      new ResendNotifier({
        apiKey: API_KEY,
        from: "Vitalos <noreply@example.invalid>",
        to: "ops@example.invalid",
        logger,
        fetch: fetchFake,
        ...(timeoutMs ? { timeoutMs } : {}),
      }),
  },
];

const rejection = async (promise: Promise<void>): Promise<NotificationError> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(NotificationError);
    return error as NotificationError;
  }
  throw new Error("expected a rejection");
};

const allLogged = (logger: ReturnType<typeof recordingLogger>) => JSON.stringify(logger.lines);

describe("request shapes", () => {
  it("postmark: URL, token header and minimal payload", async () => {
    const fetchFake = respond(200);
    await providers[0]!.make(fetchFake).send(message());
    const [url, init] = fetchFake.mock.calls[0]!;
    expect(url).toBe("https://api.postmarkapp.com/email");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Postmark-Server-Token"]).toBe(API_KEY);
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.Authorization).toBeUndefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init?.body as string) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual([
      "Attachments",
      "From",
      "Headers",
      "HtmlBody",
      "ReplyTo",
      "Subject",
      "TextBody",
      "To",
    ]);
    const attachments = body.Attachments as unknown as Record<string, string>[];
    expect(attachments.map((a) => a.ContentID)).toEqual([
      "cid:vitalos-logo",
      "cid:social-linkedin",
      "cid:social-x",
      "cid:social-instagram",
      "cid:social-facebook",
    ]);
    expect(attachments[0]).toMatchObject({
      Name: "vitalos-logo-white.png",
      ContentType: "image/png",
    });
    expect(body).toMatchObject({
      From: "Vitalos <noreply@example.invalid>",
      To: "ops@example.invalid",
      ReplyTo: "person@example.invalid",
      Subject: `New enquiry: New project · Example Person (fixture), Example Organisation (fixture) · ${referenceFromId(id)}`,
    });
    expect(body.Headers).toEqual([
      { Name: "Auto-Submitted", Value: "auto-generated" },
      { Name: "X-Auto-Response-Suppress", Value: "All" },
      { Name: "X-Vitalos-Notification", Value: "web.enquiry-notification" },
      { Name: "X-Vitalos-Reference", Value: referenceFromId(id) },
    ]);
    expect(body.TextBody).toContain("Clearly artificial non-production enquiry");
    expect(body.HtmlBody).toMatch(/^<!DOCTYPE html>/);
    expect(body.HtmlBody).toContain("Clearly artificial non-production enquiry");
  });

  it("resend: URL, bearer header, idempotency key and minimal payload", async () => {
    const fetchFake = respond(200);
    await providers[1]!.make(fetchFake).send(message());
    const [url, init] = fetchFake.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers["Idempotency-Key"]).toBe(`${id}:internal-notification`);
    expect(headers["X-Postmark-Server-Token"]).toBeUndefined();
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "attachments",
      "from",
      "headers",
      "html",
      "reply_to",
      "subject",
      "text",
      "to",
    ]);
    const attachments = body.attachments as Record<string, string>[];
    expect(attachments).toHaveLength(5);
    expect(attachments[0]).toMatchObject({
      filename: "vitalos-logo-white.png",
      content_type: "image/png",
      content_id: "vitalos-logo",
    });
    expect(body).toMatchObject({
      from: "Vitalos <noreply@example.invalid>",
      to: ["ops@example.invalid"],
      reply_to: "person@example.invalid",
      subject: `New enquiry: New project · Example Person (fixture), Example Organisation (fixture) · ${referenceFromId(id)}`,
    });
    expect(body.html).toEqual(expect.stringContaining("Reply to Example"));
    expect(body.headers).toEqual({
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
      "X-Vitalos-Notification": "web.enquiry-notification",
      "X-Vitalos-Reference": referenceFromId(id),
    });
  });
});

describe.each(providers)("$name notifier", ({ name, make }) => {
  it("subject is one line and never carries the goal", async () => {
    const fetchFake = respond(200);
    await make(fetchFake).send(
      message({ name: "Line\r\nBcc: x@example.invalid", intent: "x".repeat(200) }),
    );
    const init = fetchFake.mock.calls[0]![1]!;
    const sent = JSON.parse(init.body as string) as Record<string, string>;
    const subject = sent.Subject ?? sent.subject!;
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject.startsWith(`New enquiry: ${"x".repeat(39)}…`)).toBe(true);
    expect(subject.endsWith(` · ${referenceFromId(id)}`)).toBe(true);
    expect(subject).not.toContain("Clearly artificial non-production enquiry");
  });

  it("omits reply-to when the address is not a plain safe address", async () => {
    const fetchFake = respond(200);
    await make(fetchFake).send(
      message({ workEmail: "a@example.invalid\r\nBcc: x@example.invalid" }),
    );
    const body = fetchFake.mock.calls[0]![1]!.body as string;
    expect(body).not.toMatch(/reply_?to/i);
  });

  it("success logs identifiers only", async () => {
    const logger = recordingLogger();
    await make(respond(200), logger).send(message());
    expect(logger.lines).toHaveLength(1);
    expect(logger.lines[0]).toMatchObject({
      level: "info",
      event: "notification.email.sent",
      fields: {
        provider: name,
        kind: "internal-notification",
        reference: referenceFromId(id),
        correlationId: "corr-0001-fixture",
        status: 200,
      },
    });
    for (const marker of [...piiMarkers, API_KEY, "ops@example.invalid"]) {
      expect(allLogged(logger)).not.toContain(marker);
    }
  });

  it.each([
    [401, "email-auth-rejected", false],
    [403, "email-auth-rejected", false],
    [400, "email-rejected", false],
    [422, "email-rejected", false],
    [404, "email-http-404", false],
    [302, "email-redirect", false],
    [307, "email-redirect", false],
    [409, "email-conflict", true],
    [429, "email-rate-limited", true],
    [408, "email-timeout", true],
    [500, "email-provider-unavailable", true],
    [503, "email-provider-unavailable", true],
  ])("HTTP %i maps to %s (retryable: %s)", async (status, code, retryable) => {
    const logger = recordingLogger();
    const error = await rejection(make(respond(status), logger).send(message()));
    expect(error.code).toBe(code);
    expect(error.retryable).toBe(retryable);
    expect(classifyStatus(status)).toEqual({ code, retryable });
    // No PII, key or response body in logs or in the error.
    const text = allLogged(logger) + error.message + error.code;
    for (const marker of [...piiMarkers, API_KEY, "echo"]) expect(text).not.toContain(marker);
    expect(logger.lines[0]).toMatchObject({
      level: "warn",
      event: "notification.email.failed",
      fields: { status, errorCode: code },
    });
  });

  it("a network error is retryable and only its class is kept", async () => {
    const logger = recordingLogger();
    const fetchFake = vi.fn<typeof fetch>(() =>
      Promise.reject(new TypeError(`connect failed for ops@example.invalid with ${API_KEY}`)),
    );
    const error = await rejection(make(fetchFake, logger).send(message()));
    expect(error).toMatchObject({ code: "email-network", retryable: true });
    const text = allLogged(logger) + error.message;
    expect(text).not.toContain("ops@example.invalid");
    expect(text).not.toContain(API_KEY);
  });

  it("a timeout aborts the request and is retryable", async () => {
    const logger = recordingLogger();
    const fetchFake = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const error = await rejection(make(fetchFake, logger, 20).send(message()));
    expect(error).toMatchObject({ code: "email-timeout", retryable: true });
    expect(logger.lines[0]).toMatchObject({ fields: { errorCode: "email-timeout" } });
  });

  it("never sends a customer acknowledgement (reserved, not approved)", async () => {
    const fetchFake = respond(200);
    const error = await rejection(make(fetchFake).send({ ...message(), kind: "acknowledgement" }));
    expect(error).toMatchObject({ code: "email-kind-unsupported", retryable: false });
    expect(fetchFake).not.toHaveBeenCalled();
  });
});

describe("AI & Data pipeline headers (docs/ai-data/PLAN.md, AID-004)", () => {
  const base = { reference: referenceFromId(id), offerSlug: undefined };

  it("marks an enquiry from /ai-data with the pipeline and its offer", () => {
    expect(
      notificationHeaders({
        ...base,
        sourcePath: "/ai-data/contact",
        offerSlug: "ai-proof-of-value",
      }),
    ).toEqual({
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
      "X-Vitalos-Notification": "web.enquiry-notification",
      "X-Vitalos-Reference": referenceFromId(id),
      "X-Vitalos-Pipeline": "ai-data",
      "X-Vitalos-Offer": "ai-proof-of-value",
    });
  });

  it("adds no offer header when none was chosen", () => {
    const headers = notificationHeaders({ ...base, sourcePath: "/ai-data/contact" });
    expect(headers["X-Vitalos-Pipeline"]).toBe("ai-data");
    expect(headers).not.toHaveProperty("X-Vitalos-Offer");
  });

  it("leaves every other enquiry unchanged, including look-alike paths", () => {
    for (const sourcePath of ["/contact", "/what-we-do/ai-data", "/ai-database", undefined]) {
      const headers = notificationHeaders({
        ...base,
        sourcePath,
        offerSlug: "ai-proof-of-value",
      });
      expect(headers, String(sourcePath)).not.toHaveProperty("X-Vitalos-Pipeline");
      expect(headers, String(sourcePath)).not.toHaveProperty("X-Vitalos-Offer");
    }
  });

  it("never lets an offer value inject a header line", () => {
    const headers = notificationHeaders({
      ...base,
      sourcePath: "/ai-data/contact",
      offerSlug: "ai-proof-of-value\r\nBcc: x@example.invalid",
    });
    expect(headers).not.toHaveProperty("X-Vitalos-Offer");
    for (const value of Object.values(headers)) expect(value).not.toMatch(/[\r\n]/);
  });

  it.each(providers)(
    "$name sends the pipeline headers with the message",
    async ({ name, make }) => {
      const fetchFake = respond(200);
      await make(fetchFake).send(
        message({
          intent: "ai",
          sourcePath: "/ai-data/contact",
          offerSlug: "managed-ai-operations",
        }),
      );
      const body = JSON.parse(fetchFake.mock.calls[0]![1]?.body as string) as Record<
        string,
        unknown
      >;
      const sent =
        name === "postmark"
          ? Object.fromEntries(
              (body.Headers as { Name: string; Value: string }[]).map((h) => [h.Name, h.Value]),
            )
          : (body.headers as Record<string, string>);
      expect(sent["X-Vitalos-Pipeline"]).toBe("ai-data");
      expect(sent["X-Vitalos-Offer"]).toBe("managed-ai-operations");
    },
  );
});
