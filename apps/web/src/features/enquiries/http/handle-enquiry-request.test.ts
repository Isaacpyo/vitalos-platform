import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "@vitalos/config";
import { createEnquiryService } from "../composition";
import type { EnquiryService } from "../composition";
import { getMemoryBackendForTests } from "../composition";
import { piiMarkers, recordingLogger, siteOrigin, jsonRequest, validBody } from "../test-support";
import { handleEnquiryRequest } from "./handle-enquiry-request";
import { MAX_BODY_BYTES } from "./request-guards";

const memoryEnv = (overrides: Partial<Env["enquiry"]> = {}): Env =>
  ({
    deployEnv: "local",
    siteUrl: siteOrigin,
    supabase: { url: undefined, secretKey: undefined },
    turnstile: { siteKey: undefined, secretKey: undefined },
    enquiry: {
      backend: "memory",
      notificationTo: undefined,
      ipHashSalt: "fixture-salt-0123456789",
      outboxDispatchSecret: undefined,
      cronSecret: undefined,
      ...overrides,
    },
    email: { provider: "console", apiKey: undefined, from: undefined },
  }) as unknown as Env;

function harness(service?: EnquiryService) {
  const logger = recordingLogger();
  const backend = getMemoryBackendForTests();
  backend.repository.enquiries.clear();
  backend.repository.outbox.length = 0;
  backend.limiter.reset();
  const svc = service ?? createEnquiryService(memoryEnv(), { logger });
  const afterTasks: (() => Promise<unknown>)[] = [];
  const call = (request: Request) =>
    handleEnquiryRequest(request, {
      service: svc,
      siteOrigin,
      after: (task) => {
        afterTasks.push(task);
      },
    });
  return { call, logger, backend, afterTasks };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/enquiries (handler)", () => {
  it("202: stores the enquiry, returns a reference and schedules best-effort dispatch", async () => {
    const { call, backend, afterTasks } = harness();
    const response = await call(jsonRequest(validBody()));
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    const body = (await response.json()) as { status: string; reference: string };
    expect(body.status).toBe("accepted");
    expect(body.reference).toMatch(/^VIT-[0-9A-F]{12}$/);
    expect(backend.repository.enquiries.size).toBe(1);
    expect(backend.repository.outbox).toHaveLength(1);
    expect(afterTasks).toHaveLength(1);
    await afterTasks[0]?.();
    expect(backend.repository.outbox[0]?.state).toBe("sent");
  });

  it("echoes a well-formed inbound x-request-id and stores it as the correlation id", async () => {
    const { call, backend } = harness();
    const response = await call(jsonRequest(validBody(), { "x-request-id": "req-0123456789" }));
    expect(response.headers.get("x-request-id")).toBe("req-0123456789");
    expect([...backend.repository.enquiries.values()][0]?.correlationId).toBe("req-0123456789");
  });

  it("replayed idempotency key: same reference, one stored enquiry, one outbox row", async () => {
    const { call, backend } = harness();
    const body = validBody();
    const first = (await (await call(jsonRequest(body))).json()) as { reference: string };
    const second = await call(
      jsonRequest({ ...body, goal: "A different goal that must not overwrite the first one." }),
    );
    expect(second.status).toBe(202);
    expect(((await second.json()) as { reference: string }).reference).toBe(first.reference);
    expect(backend.repository.enquiries.size).toBe(1);
    expect(backend.repository.outbox).toHaveLength(1);
  });

  it("400: validation failure returns per-field messages and never echoes input", async () => {
    const { call, backend } = harness();
    const response = await call(
      jsonRequest(validBody({ workEmail: "secret-typo@", goal: "short" })),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; fieldErrors: Record<string, string> };
    expect(body.error).toBe("invalid");
    expect(Object.keys(body.fieldErrors).sort()).toEqual(["goal", "workEmail"]);
    expect(JSON.stringify(body)).not.toContain("secret-typo");
    expect(backend.repository.enquiries.size).toBe(0);
  });

  it("400: malformed JSON", async () => {
    const { call } = harness();
    const response = await call(jsonRequest(null, {}, { rawBody: "{not json" }));
    expect(response.status).toBe(400);
  });

  it("403: a filled honeypot is rejected and nothing is stored", async () => {
    const { call, backend } = harness();
    const response = await call(jsonRequest(validBody({ website: "https://spam.invalid" })));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "rejected" });
    expect(backend.repository.enquiries.size).toBe(0);
  });

  it("403: extra keys are rejected (no mass assignment)", async () => {
    const { call, backend } = harness();
    const response = await call(jsonRequest(validBody({ status: "closed", id: "x" })));
    expect(response.status).toBe(403);
    expect(backend.repository.enquiries.size).toBe(0);
  });

  it("403: cross-origin POST", async () => {
    const { call, backend } = harness();
    const response = await call(jsonRequest(validBody(), { origin: "https://evil.invalid" }));
    expect(response.status).toBe(403);
    expect(backend.repository.enquiries.size).toBe(0);
  });

  it("403: missing Origin header and cross-site Sec-Fetch-Site", async () => {
    const { call } = harness();
    const noOrigin = new Request(`${siteOrigin}/api/enquiries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody()),
    });
    expect((await call(noOrigin)).status).toBe(403);
    const crossSite = jsonRequest(validBody(), { "sec-fetch-site": "cross-site" });
    expect((await call(crossSite)).status).toBe(403);
  });

  it("415: a form-encoded body (what a cross-site HTML form can send)", async () => {
    const { call } = harness();
    const response = await call(
      jsonRequest(
        null,
        { "content-type": "application/x-www-form-urlencoded" },
        { rawBody: "a=b" },
      ),
    );
    expect(response.status).toBe(415);
  });

  it("413: oversized body by declared length and by actual size", async () => {
    const { call, backend } = harness();
    const huge = JSON.stringify(validBody({ goal: "x".repeat(MAX_BODY_BYTES) }));
    const declared = await call(
      jsonRequest(null, { "content-length": String(huge.length) }, { rawBody: huge }),
    );
    expect(declared.status).toBe(413);

    // A client that understates its length is still capped while streaming.
    const lying = jsonRequest(null, { "content-length": "10" }, { rawBody: huge });
    expect((await call(lying)).status).toBe(413);
    expect(backend.repository.enquiries.size).toBe(0);
  });

  it("429 with Retry-After once the per-IP budget is spent", async () => {
    const { call } = harness();
    let last: Response | undefined;
    for (let i = 0; i < 11; i += 1)
      last = await call(jsonRequest(validBody(), { "x-forwarded-for": "198.51.100.9" }));
    expect(last?.status).toBe(429);
    expect(Number(last?.headers.get("retry-after"))).toBeGreaterThan(0);
    const body = (await last?.json()) as { error: string; retryAfterSeconds: number };
    expect(body.error).toBe("rate-limited");
    // A different client is unaffected.
    const other = await call(jsonRequest(validBody(), { "x-forwarded-for": "198.51.100.10" }));
    expect(other.status).toBe(202);
  });

  it("503: honest unavailable when no backend is configured", async () => {
    const service = createEnquiryService(memoryEnv({ backend: "disabled" }));
    const { call } = harness(service);
    const response = await call(jsonRequest(validBody()));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });

  it("503: Supabase backend without the IP hash salt refuses to run", async () => {
    const logger = recordingLogger();
    const service = createEnquiryService(
      {
        ...memoryEnv({ backend: "supabase", ipHashSalt: undefined }),
        supabase: { url: "http://localhost:1", secretKey: "x".repeat(24) },
      },
      { logger },
    );
    expect(service.available).toBe(false);
    expect(logger.lines[0]).toMatchObject({ event: "enquiry.misconfigured" });
  });

  it("503: a dependency failure is reported as unavailable without detail", async () => {
    const logger = recordingLogger();
    const service = createEnquiryService(
      {
        ...memoryEnv({ backend: "supabase" }),
        supabase: { url: "http://x.invalid", secretKey: "k".repeat(24) },
      },
      {
        logger,
        rpcClient: { rpc: () => Promise.reject(new Error("person@example.invalid exploded")) },
      },
    );
    const { call } = harness(service);
    const response = await call(jsonRequest(validBody()));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("person@example.invalid");
    expect(JSON.stringify(logger.lines)).not.toContain("person@example.invalid");
    expect(logger.lines.at(-1)).toMatchObject({ event: "enquiry.unavailable" });
  });

  it("202 even when after() cannot schedule the best-effort dispatch", async () => {
    const svc = createEnquiryService(memoryEnv(), { logger: recordingLogger() });
    getMemoryBackendForTests().limiter.reset();
    const response = await handleEnquiryRequest(jsonRequest(validBody()), {
      service: svc,
      siteOrigin,
      after: () => {
        throw new Error("after() called outside a request scope");
      },
    });
    expect(response.status).toBe(202);
  });

  it("rate limits on the trusted Vercel header, ignoring a spoofed X-Forwarded-For", async () => {
    const { call } = harness();
    let last: Response | undefined;
    for (let i = 0; i < 11; i += 1) {
      last = await call(
        jsonRequest(validBody(), {
          "x-vercel-forwarded-for": "198.51.100.50",
          "x-forwarded-for": `192.0.2.${i + 1}`,
        }),
      );
    }
    expect(last?.status).toBe(429);
  });

  it("falls back past a malformed header to a valid one for rate limiting", async () => {
    const { call } = harness();
    let last: Response | undefined;
    for (let i = 0; i < 11; i += 1) {
      last = await call(
        jsonRequest(validBody(), {
          "x-real-ip": "not-an-ip",
          "x-forwarded-for": "198.51.100.60",
        }),
      );
    }
    expect(last?.status).toBe(429);
  });

  it("never writes personal data to logs", async () => {
    const { call, logger } = harness();
    await call(jsonRequest(validBody()));
    await call(jsonRequest(validBody({ workEmail: "bad" })));
    await call(jsonRequest(validBody({ website: "x" })));
    const output = JSON.stringify(logger.lines);
    for (const marker of piiMarkers) expect(output).not.toContain(marker);
    expect(output).not.toContain("203.0.113.7");
  });
});
