import { describe, expect, it } from "vitest";
import { canonicalString, sign, verifySignature } from "./signing";

// Golden vectors shared with superadmin/tests/test_relay_client.py: both apps must sign identically.
const SECRET = "relay-test-secret";
const TS = "1760536800";

describe("signing", () => {
  it("matches the Super Admin vector for a GET without admin or body", () => {
    const canonical = canonicalString({
      timestamp: TS,
      method: "GET",
      pathWithQuery: "/api/relay/admin/inbox?tab=needs",
      adminHeader: "",
      body: "",
    });
    expect(canonical).toBe(
      "1760536800\nGET\n/api/relay/admin/inbox?tab=needs\n\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sign(SECRET, canonical)).toBe(
      "v1=48ac301ebc0c3f49750dc87b280c4add3cfda52bd184865af97023d93f035a2f",
    );
  });

  it("matches the Super Admin vector for a POST with admin and body", () => {
    const canonical = canonicalString({
      timestamp: TS,
      method: "post",
      pathWithQuery: "/api/relay/admin/conversations/4f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e01/note",
      adminHeader: "eyJpZCI6InNhOjEyIn0",
      body: '{"text":"Hello"}',
    });
    expect(sign(SECRET, canonical)).toBe(
      "v1=0465c97ec03470616067d9652dc8f8659d22cc9f8a338609a0eaf5355ecd166a",
    );
  });

  it("verifies within the window, rejects stale timestamps and bad signatures, accepts a previous secret", () => {
    const body = '{"id":"x"}';
    const common = { method: "POST", pathWithQuery: "/api/inbound/relay", adminHeader: "", body };
    const good = sign(SECRET, canonicalString({ timestamp: TS, ...common }));
    const now = Number(TS);
    expect(
      verifySignature({
        secrets: [SECRET],
        timestamp: TS,
        signature: good,
        nowSeconds: now + 10,
        ...common,
      }),
    ).toEqual({ ok: true });
    expect(
      verifySignature({
        secrets: ["new-secret", SECRET],
        timestamp: TS,
        signature: good,
        nowSeconds: now + 10,
        ...common,
      }),
    ).toEqual({ ok: true });
    expect(
      verifySignature({
        secrets: [SECRET],
        timestamp: TS,
        signature: good,
        nowSeconds: now + 301,
        ...common,
      }),
    ).toEqual({ ok: false, code: "stale" });
    expect(
      verifySignature({
        secrets: [SECRET],
        timestamp: TS,
        signature: "v1=00",
        nowSeconds: now,
        ...common,
      }),
    ).toEqual({ ok: false, code: "bad_signature" });
    expect(
      verifySignature({
        secrets: [SECRET],
        timestamp: null,
        signature: good,
        nowSeconds: now,
        ...common,
      }),
    ).toEqual({ ok: false, code: "bad_signature" });
    expect(
      verifySignature({
        secrets: [SECRET],
        timestamp: TS,
        signature: good,
        nowSeconds: now,
        ...common,
        body: '{"id":"y"}',
      }),
    ).toEqual({ ok: false, code: "bad_signature" });
  });
});
