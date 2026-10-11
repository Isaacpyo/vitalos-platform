import { describe, expect, it, vi } from "vitest";
import type {
  EnquiryRepository,
  HumanVerifier,
  RateLimitDecision,
  RateLimiter,
} from "../domain/ports";
import { piiMarkers, recordingLogger, validBody } from "../test-support";
import { receiveEnquiry } from "./receive-enquiry";
import type { ReceiveEnquiryDeps } from "./receive-enquiry";

const ok: RateLimitDecision = { allowed: true, retryAfterSeconds: 0 };

function setup(
  overrides: {
    repository?: Partial<EnquiryRepository>;
    rateLimiter?: RateLimiter;
    verifier?: HumanVerifier;
  } = {},
) {
  const logger = recordingLogger();
  const repository: EnquiryRepository = {
    submit: vi.fn(() =>
      Promise.resolve({ id: crypto.randomUUID(), reference: "VIT-AAAAAAAA", duplicate: false }),
    ),
    findByIdempotencyKey: vi.fn(() => Promise.resolve(null)),
    ...overrides.repository,
  };
  const rateLimiter: RateLimiter = overrides.rateLimiter ?? {
    consume: vi.fn(() => Promise.resolve(ok)),
  };
  const verifier: HumanVerifier = overrides.verifier ?? {
    verify: vi.fn(() => Promise.resolve("disabled" as const)),
  };
  const deps: ReceiveEnquiryDeps = {
    repository,
    rateLimiter,
    verifier,
    logger,
    ipHashSalt: "fixture-salt-0123456789",
  };
  const request = (body: unknown = validBody()) => ({
    body,
    ip: "203.0.113.7",
    correlationId: "corr-0001-fixture",
  });
  return { deps, repository, rateLimiter, verifier, logger, request };
}

describe("receiveEnquiry", () => {
  it("accepted: persists once and returns the reference", async () => {
    const { deps, repository, request } = setup();
    const result = await receiveEnquiry(deps, request());
    expect(result).toEqual({ kind: "accepted", reference: "VIT-AAAAAAAA" });
    expect(repository.submit).toHaveBeenCalledTimes(1);
  });

  it("stores a salted IP hash and the correlation id, never the raw IP, token or honeypot", async () => {
    const { deps, repository, request } = setup();
    await receiveEnquiry(deps, request(validBody({ turnstileToken: "tok", website: "" })));
    const stored = vi.mocked(repository.submit).mock.calls[0]?.[0];
    expect(stored?.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.correlationId).toBe("corr-0001-fixture");
    expect(JSON.stringify(stored)).not.toContain("203.0.113.7");
    expect(stored).not.toHaveProperty("turnstileToken");
    expect(stored).not.toHaveProperty("website");
  });

  it("accepted for a replayed idempotency key without a second write signal", async () => {
    const { deps, request } = setup({
      repository: {
        submit: () =>
          Promise.resolve({ id: crypto.randomUUID(), reference: "VIT-BBBBBBBB", duplicate: true }),
      },
    });
    expect(await receiveEnquiry(deps, request())).toEqual({
      kind: "accepted",
      reference: "VIT-BBBBBBBB",
    });
  });

  it("invalid: returns field errors and does not touch limiter, verifier or database", async () => {
    const { deps, repository, rateLimiter, verifier, request } = setup();
    const result = await receiveEnquiry(
      deps,
      request(validBody({ workEmail: "nope", goal: "short" })),
    );
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(["goal", "workEmail"]);
    }
    expect(repository.submit).not.toHaveBeenCalled();
    expect(rateLimiter.consume).not.toHaveBeenCalled();
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("invalid: a non-object body is a validation failure, not a crash", async () => {
    const { deps, request } = setup();
    expect((await receiveEnquiry(deps, request(null))).kind).toBe("invalid");
    expect((await receiveEnquiry(deps, request("text"))).kind).toBe("invalid");
  });

  it("rejected: a filled honeypot looks like any other rejection and stores nothing", async () => {
    const { deps, repository, request } = setup();
    const result = await receiveEnquiry(
      deps,
      request(validBody({ website: "https://spam.invalid" })),
    );
    expect(result).toEqual({ kind: "rejected" });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("rejected: unknown keys (mass assignment attempt) are not a browser form", async () => {
    const { deps, repository, request } = setup();
    expect(await receiveEnquiry(deps, request(validBody({ status: "closed" })))).toEqual({
      kind: "rejected",
    });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("rejected: failed human verification stores nothing", async () => {
    const { deps, repository, request } = setup({
      verifier: { verify: () => Promise.resolve("failed") },
    });
    expect(await receiveEnquiry(deps, request())).toEqual({ kind: "rejected" });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("passes the Turnstile token and IP to the verifier", async () => {
    const { deps, verifier, request } = setup({
      verifier: { verify: vi.fn(() => Promise.resolve("passed" as const)) },
    });
    await receiveEnquiry(deps, request(validBody({ turnstileToken: "tok" })));
    expect(verifier.verify).toHaveBeenCalledWith({ token: "tok", ip: "203.0.113.7" });
  });

  it("rate-limited: per-IP limit returns retry-after and stops before verification", async () => {
    const consume = vi.fn(() => Promise.resolve({ allowed: false, retryAfterSeconds: 42 }));
    const { deps, repository, verifier, request } = setup({ rateLimiter: { consume } });
    expect(await receiveEnquiry(deps, request())).toEqual({
      kind: "rate-limited",
      retryAfterSeconds: 42,
    });
    expect(verifier.verify).not.toHaveBeenCalled();
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("rate-limited: the global limit applies after the per-IP limit", async () => {
    const consume = vi
      .fn<RateLimiter["consume"]>()
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 0 });
    const { deps, request } = setup({ rateLimiter: { consume } });
    const result = await receiveEnquiry(deps, request());
    // retry-after is clamped to at least one second.
    expect(result).toEqual({ kind: "rate-limited", retryAfterSeconds: 1 });
  });

  it("limiter keys are salted hashes: they never contain the IP", async () => {
    const consume = vi.fn<RateLimiter["consume"]>(() => Promise.resolve(ok));
    const { deps, request } = setup({ rateLimiter: { consume } });
    await receiveEnquiry(deps, request());
    const keys = consume.mock.calls.map(([key]) => key);
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).toMatch(/^enquiry:(ip|global):[0-9a-f]{64}$/);
      expect(key).not.toContain("203.0.113.7");
    }
  });

  it.each([
    ["repository", { repository: { submit: () => Promise.reject(new Error("boom")) } }],
    ["rate limiter", { rateLimiter: { consume: () => Promise.reject(new Error("boom")) } }],
    ["verifier", { verifier: { verify: () => Promise.reject(new Error("boom")) } }],
  ] as const)("unavailable: a %s failure fails closed", async (_label, overrides) => {
    const { deps, request } = setup(overrides);
    expect(await receiveEnquiry(deps, request())).toEqual({ kind: "unavailable" });
  });

  it("never logs name, email, goal or organisation, even when a dependency throws with them", async () => {
    const { deps, logger, request } = setup({
      repository: {
        submit: () =>
          Promise.reject(new Error("duplicate key value violates (person@example.invalid)")),
      },
    });
    await receiveEnquiry(deps, request());
    await receiveEnquiry(deps, request(validBody({ workEmail: "bad", goal: "x" })));
    await receiveEnquiry(deps, request(validBody({ website: "x" })));
    const output = JSON.stringify(logger.lines);
    for (const marker of piiMarkers) expect(output).not.toContain(marker);
    expect(output).not.toContain("203.0.113.7");
    expect(logger.lines.map((line) => line.event)).toEqual([
      "enquiry.unavailable",
      "enquiry.invalid",
      "enquiry.rejected",
    ]);
  });
});

describe("receiveEnquiry ordering and hardening", () => {
  it("answers a replay with the original reference before verifying the human or charging the global limit", async () => {
    const consume = vi.fn<RateLimiter["consume"]>(() => Promise.resolve(ok));
    const { deps, repository, verifier, request } = setup({
      rateLimiter: { consume },
      repository: {
        findByIdempotencyKey: () =>
          Promise.resolve({
            id: crypto.randomUUID(),
            reference: "VIT-CCCCCCCCCCCC",
            duplicate: true,
          }),
      },
    });
    const result = await receiveEnquiry(deps, request());
    expect(result).toEqual({ kind: "accepted", reference: "VIT-CCCCCCCCCCCC" });
    expect(verifier.verify).not.toHaveBeenCalled();
    expect(repository.submit).not.toHaveBeenCalled();
    // Only the per-IP bucket was charged.
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume.mock.calls[0]?.[0]).toMatch(/^enquiry:ip:/);
  });

  it("does not charge the global bucket when the human check fails", async () => {
    const consume = vi.fn<RateLimiter["consume"]>(() => Promise.resolve(ok));
    const { deps, request } = setup({
      rateLimiter: { consume },
      verifier: { verify: () => Promise.resolve("failed") },
    });
    expect(await receiveEnquiry(deps, request())).toEqual({ kind: "rejected" });
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume.mock.calls[0]?.[0]).toMatch(/^enquiry:ip:/);
  });

  it.each(["passed", "disabled"] as const)(
    "charges the global bucket only after the verifier returned %s, then persists",
    async (outcome) => {
      const order: string[] = [];
      const { deps, request } = setup({
        rateLimiter: {
          consume: (key) => {
            order.push(key.split(":")[1] ?? "");
            return Promise.resolve(ok);
          },
        },
        verifier: {
          verify: () => {
            order.push("verify");
            return Promise.resolve(outcome);
          },
        },
        repository: {
          submit: () => {
            order.push("submit");
            return Promise.resolve({
              id: crypto.randomUUID(),
              reference: "VIT-AAAAAAAAAAAA",
              duplicate: false,
            });
          },
        },
      });
      await receiveEnquiry(deps, request());
      expect(order).toEqual(["ip", "verify", "global", "submit"]);
    },
  );

  it("a global limit hit after verification is reported as rate-limited", async () => {
    const consume = vi
      .fn<RateLimiter["consume"]>()
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 90 });
    const { deps, repository, request } = setup({ rateLimiter: { consume } });
    expect(await receiveEnquiry(deps, request())).toEqual({
      kind: "rate-limited",
      retryAfterSeconds: 90,
    });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("requires the privacy notice version the server knows is current", async () => {
    const { deps, repository, request } = setup();
    const strict = { ...deps, privacyNoticeVersion: "2026-10" };
    const stale = await receiveEnquiry(
      strict,
      request(validBody({ privacyNoticeVersion: "2025-01" })),
    );
    expect(stale.kind).toBe("invalid");
    if (stale.kind === "invalid") {
      expect(stale.fieldErrors.consent).toMatch(/privacy notice has changed/);
    }
    expect(repository.submit).not.toHaveBeenCalled();

    const current = await receiveEnquiry(
      strict,
      request(validBody({ privacyNoticeVersion: "2026-10" })),
    );
    expect(current.kind).toBe("accepted");
    expect(vi.mocked(repository.submit).mock.calls[0]?.[0].privacyNoticeVersion).toBe("2026-10");
  });

  it("logs the SQLSTATE or adapter code of a store failure, never its message", async () => {
    const failure = Object.assign(new Error("Failing row contains (person@example.invalid)"), {
      code: "23514",
    });
    const { deps, logger, request } = setup({
      repository: { submit: () => Promise.reject(failure) },
    });
    expect(await receiveEnquiry(deps, request())).toEqual({ kind: "unavailable" });
    const line = logger.lines.find((l) => l.event === "enquiry.unavailable");
    expect(line?.fields).toMatchObject({ errorCode: "23514" });
    expect(JSON.stringify(logger.lines)).not.toContain("person@example.invalid");
  });

  it("rejects input PostgreSQL could not store as invalid (400), not unavailable (503)", async () => {
    const { deps, repository, request } = setup();
    const lonelySurrogate = String.fromCharCode(0xd800);
    for (const body of [
      validBody({ goal: `${String(validBody().goal)}${String.fromCharCode(0)}` }),
      validBody({ name: `Example${lonelySurrogate} Person` }),
      validBody({ organisation: "Example\r\nBcc: x" }),
    ]) {
      expect((await receiveEnquiry(deps, request(body))).kind).toBe("invalid");
    }
    expect(repository.submit).not.toHaveBeenCalled();
  });
});
