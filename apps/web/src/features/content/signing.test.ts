import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalString,
  signPreviewToken,
  signRequest,
  verifyPreviewToken,
  verifyRequest,
} from "./signing";
import type { SigningKey, SigningScope } from "./signing";

const keyA: SigningKey = { id: "test-a", secret: "a".repeat(40) };
const keyB: SigningKey = { id: "test-b", secret: "b".repeat(40) };
const now = 1_800_000_000;
const path = "/api/content/revalidate";
const body = JSON.stringify({ eventId: "00000000-0000-4000-8000-000000000001" });

function signed(overrides: Partial<Parameters<typeof signRequest>[0]> = {}) {
  return new Headers(
    signRequest({
      key: keyA,
      scope: "revalidate",
      method: "POST",
      pathAndQuery: path,
      body,
      timestamp: now,
      ...overrides,
    }),
  );
}

function verify(
  headers: Headers,
  overrides: Partial<Parameters<typeof verifyRequest>[0]> = {},
): ReturnType<typeof verifyRequest> {
  return verifyRequest({
    headers,
    keys: [keyA],
    scope: "revalidate",
    method: "POST",
    pathAndQuery: path,
    body,
    now,
    ...overrides,
  });
}

describe("scheme v1 request signing", () => {
  it("builds the canonical string from the contract, field by field", () => {
    const emptyHash = createHash("sha256").update("").digest("hex");
    expect(
      canonicalString({
        scope: "read",
        timestamp: 1_700_000_000,
        method: "get",
        pathAndQuery: "/api/content/v1/insights/posts?page=2",
        body: "",
      }),
    ).toBe(`v1\nread\n1700000000\nGET\n/api/content/v1/insights/posts?page=2\n${emptyHash}`);
  });

  it("matches an independently computed signature", () => {
    const headers = signed();
    const expected = createHmac("sha256", keyA.secret)
      .update(
        canonicalString({
          scope: "revalidate",
          timestamp: now,
          method: "POST",
          pathAndQuery: path,
          body,
        }),
      )
      .digest("hex");
    expect(headers.get("x-vitalos-signature")).toBe(`v1=${expected}`);
    expect(headers.get("x-vitalos-key-id")).toBe("test-a");
    expect(headers.get("x-vitalos-timestamp")).toBe(String(now));
  });

  it("accepts a valid request", () => {
    expect(verify(signed())).toEqual({ ok: true, keyId: "test-a" });
  });

  it("refuses a tampered body", () => {
    expect(verify(signed(), { body: `${body} ` })).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("refuses a tampered path or query string, and a different method", () => {
    const query = new Headers(
      signRequest({
        key: keyA,
        scope: "read",
        method: "GET",
        pathAndQuery: "/api/content/v1/insights/posts?page=2",
        timestamp: now,
      }),
    );
    const read = { scope: "read" as const, method: "GET", body: "" };
    expect(
      verify(query, { ...read, pathAndQuery: "/api/content/v1/insights/posts?page=2" }).ok,
    ).toBe(true);
    expect(
      verify(query, { ...read, pathAndQuery: "/api/content/v1/insights/posts?page=3" }),
    ).toEqual({ ok: false, reason: "bad-signature" });
    expect(verify(query, { ...read, pathAndQuery: "/api/content/v1/insights/posts" }).ok).toBe(
      false,
    );
    expect(verify(signed(), { pathAndQuery: "/api/content/render" }).ok).toBe(false);
    expect(verify(signed(), { method: "PUT" }).ok).toBe(false);
  });

  it("refuses stale and future timestamps beyond 300 s, accepts within", () => {
    expect(verify(signed(), { now: now + 300 }).ok).toBe(true);
    expect(verify(signed(), { now: now - 300 }).ok).toBe(true);
    expect(verify(signed(), { now: now + 301 })).toEqual({ ok: false, reason: "stale" });
    expect(verify(signed(), { now: now - 301 })).toEqual({ ok: false, reason: "stale" });
  });

  it("refuses a signature made for another scope", () => {
    for (const scope of ["read", "tick", "submit", "render", "preview"] as SigningScope[]) {
      expect(verify(signed({ scope })), scope).toEqual({ ok: false, reason: "bad-signature" });
    }
  });

  it("refuses an unknown key id and a key from another scope's list", () => {
    expect(verify(signed({ key: keyB }))).toEqual({ ok: false, reason: "unknown-key" });
    // Same id but a different secret (another environment or scope): signature fails.
    expect(verify(signed({ key: { id: "test-a", secret: "c".repeat(40) } }))).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("accepts either key during a two-key rotation", () => {
    const keys = [keyB, keyA];
    expect(verify(signed({ key: keyA }), { keys })).toEqual({ ok: true, keyId: "test-a" });
    expect(verify(signed({ key: keyB }), { keys })).toEqual({ ok: true, keyId: "test-b" });
    // Once the old key is removed it is refused.
    expect(verify(signed({ key: keyA }), { keys: [keyB] }).ok).toBe(false);
  });

  it("refuses missing and malformed headers, and everything when no key is configured", () => {
    expect(verify(new Headers())).toEqual({ ok: false, reason: "missing" });
    const headers = signed();
    headers.set("x-vitalos-signature", "v2=abc");
    expect(verify(headers)).toEqual({ ok: false, reason: "malformed" });
    const badId = signed();
    badId.set("x-vitalos-key-id", "Bad Id");
    expect(verify(badId)).toEqual({ ok: false, reason: "malformed" });
    const badTs = signed();
    badTs.set("x-vitalos-timestamp", "12.5");
    expect(verify(badTs)).toEqual({ ok: false, reason: "malformed" });
    expect(verify(signed(), { keys: [] })).toEqual({ ok: false, reason: "not-configured" });
  });
});

describe("preview tokens", () => {
  const id = "00000000-0000-4000-8000-000000000101";

  it("round-trips and carries the payload from the contract", () => {
    const token = signPreviewToken({ entity: "post", id, rev: "abc123" }, keyA, now);
    const result = verifyPreviewToken(token, [keyA], now + 60);
    expect(result).toEqual({
      ok: true,
      payload: { v: 1, kid: "test-a", entity: "post", id, rev: "abc123", exp: now + 900 },
    });
  });

  it("matches the contract encoding", () => {
    const token = signPreviewToken({ entity: "role", id, rev: "r1" }, keyA, now);
    const [body, mac] = token.split(".") as [string, string];
    expect(JSON.parse(Buffer.from(body, "base64url").toString("utf8"))).toMatchObject({
      v: 1,
      kid: "test-a",
      entity: "role",
    });
    expect(mac).toBe(createHmac("sha256", keyA.secret).update(body).digest("base64url"));
  });

  it("refuses expired, tampered, unknown-key and malformed tokens", () => {
    const token = signPreviewToken({ entity: "post", id, rev: "abc" }, keyA, now);
    expect(verifyPreviewToken(token, [keyA], now + 900)).toEqual({ ok: false, reason: "expired" });
    expect(verifyPreviewToken(token, [keyB], now)).toEqual({ ok: false, reason: "unknown-key" });
    const [body, mac] = token.split(".") as [string, string];
    const forged = Buffer.from(
      JSON.stringify({ v: 1, kid: "test-a", entity: "role", id, rev: "abc", exp: now + 900 }),
    ).toString("base64url");
    expect(verifyPreviewToken(`${forged}.${mac}`, [keyA], now)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
    expect(verifyPreviewToken(`${body}.${mac}x`, [keyA], now).ok).toBe(false);
    for (const bad of ["", "abc", "a.b.c", "!!.??", `${body}.`]) {
      expect(verifyPreviewToken(bad, [keyA], now).ok, bad).toBe(false);
    }
    expect(verifyPreviewToken(token, [], now)).toEqual({ ok: false, reason: "not-configured" });
  });

  it("refuses a token valid for far longer than the admin issues", () => {
    const token = signPreviewToken(
      { entity: "post", id, rev: "abc", exp: now + 86_400 },
      keyA,
      now,
    );
    expect(verifyPreviewToken(token, [keyA], now)).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a payload with an invalid entity or id", () => {
    const body = Buffer.from(
      JSON.stringify({ v: 1, kid: "test-a", entity: "page", id: "x", rev: "a", exp: now + 60 }),
    ).toString("base64url");
    const mac = createHmac("sha256", keyA.secret).update(body).digest("base64url");
    expect(verifyPreviewToken(`${body}.${mac}`, [keyA], now)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("accepts tokens from either key during rotation", () => {
    const fromB = signPreviewToken({ entity: "post", id, rev: "abc" }, keyB, now);
    expect(verifyPreviewToken(fromB, [keyA, keyB], now).ok).toBe(true);
  });
});
