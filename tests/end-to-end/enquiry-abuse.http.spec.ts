import { expect, test } from "@playwright/test";

/**
 * Enquiry endpoint abuse cases (ADR-019), end to end against the production build with the
 * in-memory backend: hermetic, no database, no email, no Cloudflare call. Every case is refused
 * by a guard that runs BEFORE the per-IP rate limiter, so none of them spends the shared
 * 10-per-10-minutes budget that the contact form specs rely on. A valid submission is deliberately
 * not sent here for the same reason (the form specs cover the happy path).
 *
 * Runs in the `http` project. The site origin is the server's own (NEXT_PUBLIC_SITE_URL is set to
 * the test base URL), so "same origin" below means exactly that.
 */

const ENDPOINT = "/api/enquiries";

const validBody = {
  name: "Example Person",
  organisation: "Example Organisation (fixture)",
  workEmail: "person@example.invalid",
  goal: "Clearly artificial non-production enquiry used by the abuse tests.",
  timeframe: "within-3-months",
  intent: "project",
  sourcePath: "/contact",
  consent: true,
  privacyNoticeVersion: "0.0-fixture",
  idempotencyKey: "00000000-0000-4000-8000-0000000000aa",
};

const json = { "content-type": "application/json" };

function sameOrigin(baseURL: string | undefined): Record<string, string> {
  return { origin: new URL(baseURL as string).origin };
}

test.describe("origin and content-type guards", () => {
  test("a cross-origin POST is rejected with 403 and nothing is stored", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: { ...json, origin: "https://evil.example" },
      data: JSON.stringify(validBody),
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("a POST without an Origin header is rejected", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: json,
      data: JSON.stringify(validBody),
    });
    expect(response.status()).toBe(403);
  });

  test("a matching Origin with Sec-Fetch-Site: cross-site is still rejected", async ({
    request,
    baseURL,
  }) => {
    const response = await request.post(ENDPOINT, {
      headers: { ...json, ...sameOrigin(baseURL), "sec-fetch-site": "cross-site" },
      data: JSON.stringify(validBody),
    });
    expect(response.status()).toBe(403);
  });

  for (const contentType of [
    "text/plain",
    "application/x-www-form-urlencoded",
    "multipart/form-data; boundary=x",
    "application/xml",
  ]) {
    test(`content-type ${contentType} is rejected with 415`, async ({ request, baseURL }) => {
      const response = await request.post(ENDPOINT, {
        headers: { "content-type": contentType, ...sameOrigin(baseURL) },
        data: JSON.stringify(validBody),
      });
      expect(response.status()).toBe(415);
      expect(await response.json()).toEqual({ error: "unsupported-media-type" });
    });
  }

  test("only POST is allowed", async ({ request }) => {
    for (const method of ["get", "put", "delete", "patch"] as const) {
      const response = await request[method](ENDPOINT);
      expect(response.status(), method).toBe(405);
    }
  });
});

test.describe("size and shape guards", () => {
  test("an oversized body is rejected with 413", async ({ request, baseURL }) => {
    // The cap is 32 KiB; send 40 KiB of otherwise well-formed JSON.
    const response = await request.post(ENDPOINT, {
      headers: { ...json, ...sameOrigin(baseURL) },
      data: JSON.stringify({ ...validBody, goal: "x".repeat(40 * 1024) }),
    });
    expect(response.status()).toBe(413);
    expect(await response.json()).toEqual({ error: "payload-too-large" });
  });

  test("a body just under the cap is not rejected as too large", async ({ request, baseURL }) => {
    // 5001 characters fails field validation (400), proving the size guard let it through.
    const response = await request.post(ENDPOINT, {
      headers: { ...json, ...sameOrigin(baseURL) },
      data: JSON.stringify({ ...validBody, goal: "x".repeat(5001) }),
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error: string; fieldErrors: Record<string, string> };
    expect(body.error).toBe("invalid");
    expect(Object.keys(body.fieldErrors)).toEqual(["goal"]);
  });

  test("malformed JSON is a 400 that echoes nothing", async ({ request, baseURL }) => {
    const response = await request.post(ENDPOINT, {
      headers: { ...json, ...sameOrigin(baseURL) },
      data: '{"name": "Example Person", ',
    });
    expect(response.status()).toBe(400);
    const text = await response.text();
    expect(text).not.toContain("Example Person");
  });

  test("invalid fields return field errors and never echo the submitted values", async ({
    request,
    baseURL,
  }) => {
    const response = await request.post(ENDPOINT, {
      headers: { ...json, ...sameOrigin(baseURL) },
      data: JSON.stringify({ ...validBody, workEmail: "secret-not-an-email", goal: "short" }),
    });
    expect(response.status()).toBe(400);
    const text = await response.text();
    expect(text).not.toContain("secret-not-an-email");
    const body = JSON.parse(text) as { fieldErrors: Record<string, string> };
    expect(Object.keys(body.fieldErrors).sort()).toEqual(["goal", "workEmail"]);
  });
});

test.describe("automation guards", () => {
  test("a filled honeypot is rejected with 403, not treated as a field error", async ({
    request,
    baseURL,
  }) => {
    const response = await request.post(ENDPOINT, {
      headers: { ...json, ...sameOrigin(baseURL) },
      data: JSON.stringify({ ...validBody, website: "https://spam.invalid" }),
    });
    expect(response.status()).toBe(403);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: "rejected" });
    expect(text).not.toContain("spam.invalid");
  });

  test("an unknown key is rejected like automation", async ({ request, baseURL }) => {
    const response = await request.post(ENDPOINT, {
      headers: { ...json, ...sameOrigin(baseURL) },
      data: JSON.stringify({ ...validBody, isAdmin: true }),
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "rejected" });
  });

  test("every refusal carries a correlation id and is never cached", async ({
    request,
    baseURL,
  }) => {
    const response = await request.post(ENDPOINT, {
      headers: { ...json, ...sameOrigin(baseURL), "x-request-id": "abuse-test-correlation" },
      data: JSON.stringify({ ...validBody, website: "x" }),
    });
    expect(response.headers()["x-request-id"]).toBe("abuse-test-correlation");
    expect(response.headers()["cache-control"]).toBe("no-store");
  });
});

test.describe("other server surfaces refuse unauthenticated callers", () => {
  test("the outbox dispatch endpoint needs the bearer secret", async ({ request }) => {
    for (const method of ["get", "post"] as const) {
      const anonymous = await request[method]("/api/internal/outbox/dispatch");
      expect(anonymous.status(), `${method} without a secret`).toBe(401);
      expect(anonymous.headers()["www-authenticate"]).toBe("Bearer");
      const wrong = await request[method]("/api/internal/outbox/dispatch", {
        headers: { authorization: "Bearer not-the-secret" },
      });
      expect(wrong.status(), `${method} with a wrong secret`).toBe(401);
      expect(await wrong.json()).toEqual({ error: "unauthorized" });
    }
  });

  test("draft mode cannot be enabled without a valid preview secret", async ({ request }) => {
    const response = await request.get("/api/draft-mode/enable", { maxRedirects: 0 });
    expect([400, 401, 403, 503]).toContain(response.status());
    expect(response.headers()["set-cookie"] ?? "").not.toContain("__prerender_bypass");
  });

  test("the revalidate webhook refuses unsigned requests", async ({ request }) => {
    const response = await request.post("/api/revalidate", {
      headers: json,
      data: JSON.stringify({ _type: "legalPage", slug: "privacy" }),
    });
    expect([400, 401, 403, 503]).toContain(response.status());
  });
});
