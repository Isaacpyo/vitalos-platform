import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createRevalidateHandler } from "./revalidate-handler";
import { MAX_BODY_BYTES, SIGNATURE_HEADER, tagsForPayload, verifySanitySignature } from "./webhook";

// Test-only value; it protects nothing.
const SECRET = "test-only-webhook-secret-not-real";
const NOW = 1_800_000_000_000;

function sign(body: string, secret = SECRET, timestamp = NOW): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("base64url");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifySanitySignature", () => {
  const body = JSON.stringify({ _type: "practice", slug: { current: "consulting" } });

  it("accepts a correctly signed body", () => {
    expect(verifySanitySignature({ body, header: sign(body), secret: SECRET, now: NOW })).toBe(
      true,
    );
  });

  it("rejects a wrong secret, a tampered body and a missing or malformed header", () => {
    expect(
      verifySanitySignature({
        body,
        header: sign(body, "another-secret-value-xx"),
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      verifySanitySignature({ body: body + " ", header: sign(body), secret: SECRET, now: NOW }),
    ).toBe(false);
    expect(verifySanitySignature({ body, header: null, secret: SECRET, now: NOW })).toBe(false);
    expect(verifySanitySignature({ body, header: "v1=abc", secret: SECRET, now: NOW })).toBe(false);
    expect(
      verifySanitySignature({ body, header: `t=${NOW},v1=short`, secret: SECRET, now: NOW }),
    ).toBe(false);
  });

  it("rejects stale and future-dated signatures (replay window)", () => {
    const old = sign(body, SECRET, NOW - 11 * 60 * 1000);
    expect(verifySanitySignature({ body, header: old, secret: SECRET, now: NOW })).toBe(false);
    const future = sign(body, SECRET, NOW + 11 * 60 * 1000);
    expect(verifySanitySignature({ body, header: future, secret: SECRET, now: NOW })).toBe(false);
    const recent = sign(body, SECRET, NOW - 60 * 1000);
    expect(verifySanitySignature({ body, header: recent, secret: SECRET, now: NOW })).toBe(true);
  });

  it("rejects an empty body or empty secret", () => {
    expect(verifySanitySignature({ body: "", header: sign(""), secret: SECRET, now: NOW })).toBe(
      false,
    );
    expect(verifySanitySignature({ body, header: sign(body), secret: "", now: NOW })).toBe(false);
  });
});

describe("tagsForPayload", () => {
  it("reads _type and a slug object or string", () => {
    expect(tagsForPayload({ _type: "offer", slug: { current: "ai-readiness" } })).toEqual([
      "sanity",
      "sanity:offer",
      "sanity:offer:ai-readiness",
    ]);
    expect(tagsForPayload({ _type: "offer", slug: "ai-readiness" })).toContain(
      "sanity:offer:ai-readiness",
    );
  });

  it("falls back to the root tag for unknown payloads", () => {
    expect(tagsForPayload(null)).toEqual(["sanity"]);
    expect(tagsForPayload("text")).toEqual(["sanity"]);
    expect(tagsForPayload({})).toEqual(["sanity"]);
  });
});

describe("revalidate handler", () => {
  const payload = JSON.stringify({ _type: "practice", slug: { current: "consulting" } });

  function setup(secret: string | null = SECRET) {
    const revalidateTag = vi.fn();
    const handler = createRevalidateHandler({
      secret: secret ?? undefined,
      revalidateTag,
      now: () => NOW,
    });
    const post = (body: string, headers: Record<string, string> = {}) =>
      handler(
        new Request("https://example.invalid/api/revalidate", { method: "POST", body, headers }),
      );
    return { revalidateTag, post };
  }

  it("revalidates the tags of a validly signed webhook and expires them immediately", async () => {
    const { post, revalidateTag } = setup();
    const response = await post(payload, { [SIGNATURE_HEADER]: sign(payload) });
    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("sanity", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("sanity:practice:consulting", { expire: 0 });
  });

  it("refuses an unsigned request and revalidates nothing", async () => {
    const { post, revalidateTag } = setup();
    expect((await post(payload)).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses a forged signature", async () => {
    const { post, revalidateTag } = setup();
    const forged = sign(payload, "attacker-chosen-secret-value");
    expect((await post(payload, { [SIGNATURE_HEADER]: forged })).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("fails closed when no secret is configured, even for a request signed with an empty secret", async () => {
    const { post, revalidateTag } = setup(null);
    const response = await post(payload, { [SIGNATURE_HEADER]: sign(payload, "") });
    expect(response.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses oversized bodies before verifying them", async () => {
    const { post, revalidateTag } = setup();
    const big = JSON.stringify({ pad: "x".repeat(MAX_BODY_BYTES) });
    expect((await post(big, { [SIGNATURE_HEADER]: sign(big) })).status).toBe(413);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("stops reading a chunked body that has no Content-Length once it exceeds the cap", async () => {
    const { revalidateTag } = setup();
    let pulled = 0;
    const chunk = new TextEncoder().encode("x".repeat(16 * 1024));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 1000) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const handler = createRevalidateHandler({ secret: SECRET, revalidateTag, now: () => NOW });
    const response = await handler(
      new Request("https://example.invalid/api/revalidate", {
        method: "POST",
        body,
        headers: { [SIGNATURE_HEADER]: sign("irrelevant") },
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(413);
    expect(pulled).toBeLessThan(20);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses an unsigned request without reading its body", async () => {
    const { revalidateTag } = setup();
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new TextEncoder().encode("x"));
      },
    });
    const handler = createRevalidateHandler({ secret: SECRET, revalidateTag, now: () => NOW });
    const response = await handler(
      new Request("https://example.invalid/api/revalidate", {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(401);
    expect(pulled).toBeLessThanOrEqual(1);
  });

  it("rejects a signed body that is not JSON", async () => {
    const { post, revalidateTag } = setup();
    expect((await post("not json", { [SIGNATURE_HEADER]: sign("not json") })).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("does not echo request content or the secret in responses", async () => {
    const { post } = setup();
    const response = await post(payload, { [SIGNATURE_HEADER]: sign("other") });
    const text = await response.text();
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("consulting");
  });
});
