import { describe, expect, it } from "vitest";
import {
  clientIpFromForwardedFor,
  clientIpFromHeaders,
  rateLimitKey,
  saltedHash,
} from "./rate-limit";

describe("clientIpFromHeaders", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("prefers the Vercel edge header, then x-real-ip, then x-forwarded-for", () => {
    const all = {
      "x-vercel-forwarded-for": "203.0.113.1",
      "x-real-ip": "203.0.113.2",
      "x-forwarded-for": "203.0.113.3",
    };
    expect(clientIpFromHeaders(h(all))).toBe("203.0.113.1");
    expect(
      clientIpFromHeaders(h({ "x-real-ip": "203.0.113.2", "x-forwarded-for": "203.0.113.3" })),
    ).toBe("203.0.113.2");
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "203.0.113.3, 10.0.0.1" }))).toBe(
      "203.0.113.3",
    );
  });

  it("falls through a malformed header instead of giving up", () => {
    expect(
      clientIpFromHeaders(h({ "x-real-ip": "not an ip", "x-forwarded-for": "203.0.113.3" })),
    ).toBe("203.0.113.3");
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "junk, 203.0.113.3" }))).toBeUndefined();
    expect(clientIpFromHeaders(h({}))).toBeUndefined();
  });
});

const salt = "fixture-salt-0123456789";

describe("saltedHash", () => {
  it("is deterministic, salt-dependent and never contains the input", async () => {
    const a = await saltedHash("203.0.113.7", salt);
    expect(a).toBe(await saltedHash("203.0.113.7", salt));
    expect(a).not.toBe(await saltedHash("203.0.113.7", "another-salt-0123456789"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("203");
  });

  it("refuses an empty salt", async () => {
    await expect(saltedHash("x", "")).rejects.toThrow();
  });
});

describe("rateLimitKey", () => {
  it("scopes the hash and keeps the identifier out of the key", async () => {
    const key = await rateLimitKey("enquiry:ip", "203.0.113.7", salt);
    expect(key).toMatch(/^enquiry:ip:[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(await rateLimitKey("enquiry:email", "203.0.113.7", salt)).not.toBe(key);
  });

  it("rejects malformed scopes", async () => {
    await expect(rateLimitKey("Bad Scope", "x", salt)).rejects.toThrow();
  });
});

describe("clientIpFromForwardedFor", () => {
  it("takes the first hop and ignores junk", () => {
    expect(clientIpFromForwardedFor("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
    expect(clientIpFromForwardedFor("2001:db8::1")).toBe("2001:db8::1");
    expect(clientIpFromForwardedFor("<script>")).toBeUndefined();
    expect(clientIpFromForwardedFor(null)).toBeUndefined();
    expect(clientIpFromForwardedFor("")).toBeUndefined();
  });
});
