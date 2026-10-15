import { describe, expect, it, vi } from "vitest";
import { isTurnstileTestSecret, TURNSTILE_SITEVERIFY_URL, verifyTurnstileToken } from "./turnstile";

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

const base = {
  secret: "fixture-secret-value",
  token: "fixture-token",
  expectedAction: "enquiry",
  expectedHostname: "www.example.invalid",
} as const;

describe("verifyTurnstileToken", () => {
  it("passes when Cloudflare confirms token, hostname and action", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(json({ success: true, hostname: "www.example.invalid", action: "enquiry" })),
    );
    const result = await verifyTurnstileToken({
      ...base,
      remoteIp: "203.0.113.7",
      fetch: fetchMock,
    });
    expect(result).toEqual({ success: true, errorCodes: [] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    const sent = init.body as URLSearchParams;
    expect(sent.get("response")).toBe("fixture-token");
    expect(sent.get("remoteip")).toBe("203.0.113.7");
  });

  it("fails closed on a rejected token and surfaces error codes only", async () => {
    const result = await verifyTurnstileToken({
      ...base,
      fetch: () =>
        Promise.resolve(json({ success: false, "error-codes": ["invalid-input-response"] })),
    });
    expect(result).toEqual({ success: false, errorCodes: ["invalid-input-response"] });
  });

  it("rejects a hostname or action mismatch", async () => {
    const wrongHost = await verifyTurnstileToken({
      ...base,
      fetch: () =>
        Promise.resolve(json({ success: true, hostname: "evil.invalid", action: "enquiry" })),
    });
    expect(wrongHost.errorCodes).toEqual(["hostname-mismatch"]);
    const wrongAction = await verifyTurnstileToken({
      ...base,
      fetch: () =>
        Promise.resolve(json({ success: true, hostname: "www.example.invalid", action: "login" })),
    });
    expect(wrongAction.errorCodes).toEqual(["action-mismatch"]);
  });

  it("skips hostname and action pinning only for Cloudflare's documented test secrets", async () => {
    const secret = "1x0000000000000000000000000000000AA";
    expect(isTurnstileTestSecret(secret)).toBe(true);
    expect(isTurnstileTestSecret("0x4AAAAAAAreal-looking-secret")).toBe(false);
    const result = await verifyTurnstileToken({
      ...base,
      secret,
      fetch: () => Promise.resolve(json({ success: true, hostname: "example.com" })),
    });
    expect(result.success).toBe(true);
  });

  it("reports provider failures with distinct codes and never throws", async () => {
    const down = await verifyTurnstileToken({
      ...base,
      fetch: () => Promise.reject(new TypeError("x")),
    });
    expect(down.errorCodes).toEqual(["network-error"]);
    const timeout = await verifyTurnstileToken({
      ...base,
      fetch: () => Promise.reject(new DOMException("t", "TimeoutError")),
    });
    expect(timeout.errorCodes).toEqual(["timeout"]);
    const http = await verifyTurnstileToken({
      ...base,
      fetch: () => Promise.resolve(new Response("nope", { status: 500 })),
    });
    expect(http.errorCodes).toEqual(["http-error"]);
    const garbage = await verifyTurnstileToken({
      ...base,
      fetch: () => Promise.resolve(new Response("not json")),
    });
    expect(garbage.errorCodes).toEqual(["invalid-response"]);
  });

  it("rejects an empty token without calling Cloudflare", async () => {
    const fetchMock = vi.fn();
    const result = await verifyTurnstileToken({ ...base, token: "", fetch: fetchMock });
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never leaks the secret or token into the result", async () => {
    const result = await verifyTurnstileToken({
      ...base,
      fetch: () => Promise.resolve(json({ success: false, "error-codes": ["bad-request"] })),
    });
    expect(JSON.stringify(result)).not.toContain("fixture-secret-value");
    expect(JSON.stringify(result)).not.toContain("fixture-token");
  });
});

describe("Cloudflare dummy secrets are answered without the network", () => {
  const dummy = (digit: string) => `${digit}x0000000000000000000000000000000AA`;
  const noNetwork = () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network is down"));
    return spy;
  };

  it("passes the always-pass secret even when the network is down", async () => {
    const spy = noNetwork();
    const result = await verifyTurnstileToken({ ...base, secret: dummy("1") });
    expect(result).toEqual({ success: true, errorCodes: [] });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("fails the always-fail and already-spent secrets as token errors, never as provider errors", async () => {
    const spy = noNetwork();
    expect(await verifyTurnstileToken({ ...base, secret: dummy("2") })).toEqual({
      success: false,
      errorCodes: ["invalid-input-response"],
    });
    expect(await verifyTurnstileToken({ ...base, secret: dummy("3") })).toEqual({
      success: false,
      errorCodes: ["timeout-or-duplicate"],
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("still calls Cloudflare for any other secret, and fails closed when it is unreachable", async () => {
    const spy = noNetwork();
    const result = await verifyTurnstileToken({ ...base, secret: "0x4AAAAAAAreal-looking-secret" });
    expect(result.errorCodes).toEqual(["network-error"]);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("pins the careers action too", async () => {
    const result = await verifyTurnstileToken({
      secret: "real-secret-value",
      token: "token",
      expectedAction: "careers",
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ success: true, hostname: "x", action: "enquiry" })),
        ),
    });
    expect(result).toEqual({ success: false, errorCodes: ["action-mismatch"] });
  });
});
