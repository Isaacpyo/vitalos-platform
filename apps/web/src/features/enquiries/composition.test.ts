import { describe, expect, it, vi } from "vitest";
import type { Env } from "@vitalos/config";
import { createEnquiryService } from "./composition";
import type { RpcClient } from "./adapters/supabase-rpc";
import { recordingLogger, validBody } from "./test-support";

const rpcClient: RpcClient = {
  rpc: vi.fn((fn: string) => {
    if (fn === "rate_limit_consume") {
      return Promise.resolve({ data: { allowed: true, retryAfterSeconds: 0 }, error: null });
    }
    if (fn === "find_enquiry_reference") return Promise.resolve({ data: null, error: null });
    return Promise.resolve({
      data: { id: crypto.randomUUID(), reference: "VIT-AAAAAAAAAAAA", duplicate: false },
      error: null,
    });
  }),
};

const env = (deployEnv: Env["deployEnv"], overrides: Record<string, unknown> = {}): Env =>
  ({
    deployEnv,
    siteUrl: "https://www.example.invalid",
    supabase: { url: "https://project.example.invalid", secretKey: "k".repeat(24) },
    turnstile: { siteKey: undefined, secretKey: undefined },
    enquiry: {
      backend: "supabase",
      ipHashSalt: "fixture-salt-0123456789",
      privacyNoticeVersion: "fixture-1",
      ...((overrides.enquiry as object | undefined) ?? {}),
    },
    email: { provider: "none" },
    ...(overrides.turnstile ? { turnstile: overrides.turnstile } : {}),
  }) as unknown as Env;

describe("production fails closed", () => {
  it("never runs without a Turnstile secret (no disabled verifier in production)", async () => {
    const logger = recordingLogger();
    const service = createEnquiryService(env("production"), { rpcClient, logger });
    expect(service.available).toBe(false);
    expect(await service.receive({ body: validBody(), ip: undefined, correlationId: "c" })).toEqual(
      {
        kind: "unavailable",
      },
    );
    expect(logger.lines[0]).toMatchObject({
      event: "enquiry.misconfigured",
      fields: { missing: "TURNSTILE_SECRET_KEY" },
    });
  });

  it("never runs without a pinned privacy notice version", () => {
    const service = createEnquiryService(
      env("production", {
        turnstile: { siteKey: "site-key-fixture", secretKey: "secret-key-fixture" },
        enquiry: { privacyNoticeVersion: undefined },
      }),
      { rpcClient, logger: recordingLogger() },
    );
    expect(service.available).toBe(false);
  });

  it("with Turnstile configured, a missing token is rejected rather than waved through", async () => {
    const service = createEnquiryService(
      env("production", {
        turnstile: { siteKey: "site-key-fixture", secretKey: "secret-key-fixture" },
      }),
      { rpcClient, logger: recordingLogger() },
    );
    expect(service.available).toBe(true);
    const result = await service.receive({
      body: validBody(),
      ip: "203.0.113.9",
      correlationId: "c",
    });
    expect(result).toEqual({ kind: "rejected" });
  });

  it("outside production a missing Turnstile secret is allowed (local and preview)", () => {
    for (const deployEnv of ["local", "preview", "staging"] as const) {
      const service = createEnquiryService(env(deployEnv), {
        rpcClient,
        logger: recordingLogger(),
      });
      expect(service.available).toBe(true);
    }
  });

  it("rejects a stale privacy notice version end to end", async () => {
    const service = createEnquiryService(env("local"), { rpcClient, logger: recordingLogger() });
    const result = await service.receive({
      body: validBody({ privacyNoticeVersion: "older-version" }),
      ip: undefined,
      correlationId: "c",
    });
    expect(result.kind).toBe("invalid");
  });
});
