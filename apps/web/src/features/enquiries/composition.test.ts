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

describe("email notifier selection", () => {
  const emailEnv = (email: Record<string, unknown>, notificationTo?: string) =>
    ({
      ...env("local", { enquiry: { backend: "memory", notificationTo } }),
      email,
    }) as unknown as Env;
  const configured = { apiKey: "key-fixture-0001", from: "Vitalos <noreply@example.invalid>" };
  const to = "ops@example.invalid";

  const dispatchWith = async (e: Env) => {
    const fetchFake = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("{}", { status: 200 })),
    );
    const logger = recordingLogger();
    const service = createEnquiryService(e, { logger, fetch: fetchFake });
    await service.receive({ body: validBody(), ip: undefined, correlationId: "c" });
    return { summary: await service.dispatch(), fetchFake, logger };
  };

  it("none has no notifier, so dispatch reports not configured (null)", async () => {
    const { summary, fetchFake } = await dispatchWith(emailEnv({ provider: "none" }, to));
    expect(summary).toBeNull();
    expect(fetchFake).not.toHaveBeenCalled();
  });

  it.each([
    ["postmark", "https://api.postmarkapp.com/email"],
    ["resend", "https://api.resend.com/emails"],
  ])("%s is wired from config and sends through the injected fetch", async (provider, url) => {
    const { summary, fetchFake } = await dispatchWith(emailEnv({ provider, ...configured }, to));
    expect(summary?.sent).toBeGreaterThanOrEqual(1);
    expect(fetchFake.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const [requested] of fetchFake.mock.calls) expect(requested).toBe(url);
  });

  it("a selected provider missing its key or recipient yields no notifier and logs names only", async () => {
    const noKey = await dispatchWith(emailEnv({ provider: "resend", from: configured.from }, to));
    expect(noKey.summary).toBeNull();
    expect(noKey.logger.lines.find((l) => l.event === "notifier.misconfigured")?.fields).toEqual({
      provider: "resend",
      missing: "EMAIL_PROVIDER_API_KEY",
    });
    const noTo = await dispatchWith(emailEnv({ provider: "postmark", ...configured }));
    expect(noTo.summary).toBeNull();
    expect(noTo.fetchFake).not.toHaveBeenCalled();
    expect(noTo.logger.lines.find((l) => l.event === "notifier.misconfigured")?.fields).toEqual({
      provider: "postmark",
      missing: "ENQUIRY_NOTIFICATION_TO",
    });
  });
});
