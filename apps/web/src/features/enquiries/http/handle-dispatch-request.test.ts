import { describe, expect, it, vi } from "vitest";
import type { EnquiryService } from "../composition";
import { handleDispatchRequest, bearerMatches } from "./handle-dispatch-request";
import { correlationIdFrom, isSameOrigin, readBodyWithLimit } from "./request-guards";

const secret = "s".repeat(40);
const service = (overrides: Partial<EnquiryService> = {}): EnquiryService => ({
  available: true,
  receive: () => Promise.resolve({ kind: "unavailable" }),
  dispatch: vi.fn(() => Promise.resolve({ claimed: 2, sent: 2, retried: 0, failed: 0 })),
  purgeExpired: () => Promise.resolve({ purged: 0 }),
  ...overrides,
});
const request = (authorization?: string) =>
  new Request("https://www.example.invalid/api/internal/outbox/dispatch", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });

describe("handleDispatchRequest", () => {
  it("401 without or with a wrong bearer secret, and does not dispatch", async () => {
    const svc = service();
    for (const header of [undefined, "Bearer wrong", `Basic ${secret}`, "Bearer ", secret]) {
      const response = await handleDispatchRequest(request(header), {
        service: svc,
        secrets: [secret],
      });
      expect(response.status).toBe(401);
    }
    expect(svc.dispatch).not.toHaveBeenCalled();
  });

  it("200 with counts only when the secret matches", async () => {
    const response = await handleDispatchRequest(request(`Bearer ${secret}`), {
      service: service(),
      secrets: [secret],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      claimed: 2,
      sent: 2,
      retried: 0,
      failed: 0,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("503 when the endpoint secret is not configured (never open by default)", async () => {
    const response = await handleDispatchRequest(request(`Bearer ${secret}`), {
      service: service(),
      secrets: [undefined],
    });
    expect(response.status).toBe(503);
  });

  it("accepts either OUTBOX_DISPATCH_SECRET or CRON_SECRET, ignoring unset entries", async () => {
    const cron = "c".repeat(20);
    const svc = service();
    const deps = { service: svc, secrets: [secret, cron, undefined] };
    expect((await handleDispatchRequest(request(`Bearer ${secret}`), deps)).status).toBe(200);
    expect((await handleDispatchRequest(request(`Bearer ${cron}`), deps)).status).toBe(200);
    expect((await handleDispatchRequest(request("Bearer nope"), deps)).status).toBe(401);
    // Only CRON_SECRET configured (the Vercel Cron case).
    const only = { service: svc, secrets: [undefined, cron] };
    expect((await handleDispatchRequest(request(`Bearer ${cron}`), only)).status).toBe(200);
    expect((await handleDispatchRequest(request(`Bearer ${secret}`), only)).status).toBe(401);
  });

  it("503 when neither secret is set, even for an empty bearer", async () => {
    const response = await handleDispatchRequest(request("Bearer "), {
      service: service(),
      secrets: [undefined, ""],
    });
    expect(response.status).toBe(503);
  });

  it("503 when there is no backend or no notifier configured", async () => {
    const noBackend = await handleDispatchRequest(request(`Bearer ${secret}`), {
      service: service({ available: false }),
      secrets: [secret],
    });
    expect(noBackend.status).toBe(503);
    const noNotifier = await handleDispatchRequest(request(`Bearer ${secret}`), {
      service: service({ dispatch: () => Promise.resolve(null) }),
      secrets: [secret],
    });
    expect(noNotifier.status).toBe(503);
    expect(await noNotifier.json()).toEqual({ error: "notifications-not-configured" });
  });
});

describe("bearerMatches", () => {
  it("compares digests, so different lengths are safe", () => {
    expect(bearerMatches(`Bearer ${secret}`, secret)).toBe(true);
    expect(bearerMatches(`Bearer ${secret}x`, secret)).toBe(false);
    expect(bearerMatches(null, secret)).toBe(false);
  });
});

describe("request guards", () => {
  it("correlationIdFrom keeps well-formed ids and replaces junk", () => {
    expect(correlationIdFrom(new Headers({ "x-request-id": "req-0123456789" }))).toBe(
      "req-0123456789",
    );
    expect(correlationIdFrom(new Headers({ "x-request-id": "short id with spaces" }))).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(correlationIdFrom(new Headers())).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("isSameOrigin accepts the site origin and the request host, nothing else", () => {
    const site = "https://www.example.invalid";
    expect(isSameOrigin(new Headers({ origin: site }), site)).toBe(true);
    expect(
      isSameOrigin(
        new Headers({ origin: "https://preview.example.invalid", host: "preview.example.invalid" }),
        site,
      ),
    ).toBe(true);
    expect(
      isSameOrigin(
        new Headers({ origin: "https://evil.invalid", host: "www.example.invalid" }),
        site,
      ),
    ).toBe(false);
    expect(isSameOrigin(new Headers({ origin: "null" }), site)).toBe(false);
    expect(isSameOrigin(new Headers(), site)).toBe(false);
    expect(isSameOrigin(new Headers({ origin: site, "sec-fetch-site": "same-site" }), site)).toBe(
      false,
    );
  });

  it("readBodyWithLimit reads small bodies and cancels oversized ones", async () => {
    const small = new Request("https://x.invalid", { method: "POST", body: "hello" });
    expect(await readBodyWithLimit(small, 100)).toEqual({ ok: true, text: "hello" });
    const big = new Request("https://x.invalid", { method: "POST", body: "x".repeat(200) });
    expect(await readBodyWithLimit(big, 100)).toEqual({ ok: false, reason: "too-large" });
  });
});
