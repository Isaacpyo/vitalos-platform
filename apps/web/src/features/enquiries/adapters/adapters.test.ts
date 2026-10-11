import { describe, expect, it, vi } from "vitest";
import { enquirySchemaV2 } from "@vitalos/validation/enquiry";
import type { NewEnquiry } from "../domain/enquiry";
import { referenceFromId } from "../domain/enquiry";
import { mutableClock, recordingLogger, validBody } from "../test-support";
import { ConsoleNotifier } from "./console-notifier";
import { createEnquiryLogger } from "./observability-logger";
import { MemoryRateLimiter } from "./memory-rate-limiter";
import { PostgresRateLimiter } from "./postgres-rate-limiter";
import { DisabledVerifier, TurnstileVerifier } from "./turnstile-verifier";
import { SupabaseEnquiryRepository, toSubmitPayload } from "./supabase-repository";
import { SupabaseOutboxStore } from "./supabase-outbox";
import { callRpc, EnquiryStoreError } from "./supabase-rpc";
import type { RpcClient } from "./supabase-rpc";

const newEnquiry = (): NewEnquiry => {
  const {
    turnstileToken: _t,
    website: _w,
    ...rest
  } = enquirySchemaV2.parse(validBody({ utm: { source: "fixture" }, offerSlug: "example-offer" }));
  void _t;
  void _w;
  return { ...rest, ipHash: "a".repeat(64), correlationId: "corr-0001-fixture" };
};

const rpcReturning = (data: unknown, error: { code?: string } | null = null) => {
  const rpc = vi.fn<RpcClient["rpc"]>(() => Promise.resolve({ data, error }));
  return { rpc } satisfies RpcClient;
};

describe("supabase adapters", () => {
  it("submit_enquiry receives the camelCase payload and returns the parsed result", async () => {
    const id = crypto.randomUUID();
    const client = rpcReturning({ id, reference: referenceFromId(id), duplicate: false });
    const result = await new SupabaseEnquiryRepository(client).submit(newEnquiry());
    expect(result).toEqual({ id, reference: referenceFromId(id), duplicate: false });
    expect(client.rpc).toHaveBeenCalledWith("submit_enquiry", {
      p: expect.objectContaining({
        workEmail: "person@example.invalid",
        intent: "project",
        utm: { source: "fixture" },
        offerSlug: "example-offer",
        ipHash: "a".repeat(64),
        consent: true,
      }),
    });
    expect(toSubmitPayload(newEnquiry())).not.toHaveProperty("turnstileToken");
  });

  it("maps database errors to a code-only error that never carries row data", async () => {
    const client = rpcReturning(null, { code: "23514" });
    const error = await new SupabaseEnquiryRepository(client)
      .submit(newEnquiry())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EnquiryStoreError);
    expect((error as EnquiryStoreError).message).toBe("23514");

    const thrown = { rpc: () => Promise.reject(new Error("row (person@example.invalid)")) };
    const transport = await callRpc(thrown, "x", {}).catch((e: unknown) => e);
    expect((transport as Error).message).toBe("rpc-transport-failure");
  });

  it("rejects an unexpected result shape", async () => {
    await expect(
      new SupabaseEnquiryRepository(rpcReturning({ id: "not-a-uuid" })).submit(newEnquiry()),
    ).rejects.toThrow("unexpected-result");
  });

  it("outbox claim parses work items and nulls become undefined", async () => {
    const id = crypto.randomUUID();
    const enquiryId = crypto.randomUUID();
    const client = rpcReturning([
      {
        id,
        kind: "internal-notification",
        eventType: "enquiry.received.v1",
        attempts: 1,
        correlationId: null,
        event: {
          eventId: id,
          eventType: "enquiry.received.v1",
          eventVersion: 1,
          occurredAt: "2026-10-11T09:00:00Z",
          producer: "vitalos-web",
          correlationId: null,
          payload: { enquiryId, reference: referenceFromId(enquiryId), intent: "project" },
        },
        enquiry: {
          id: enquiryId,
          reference: referenceFromId(enquiryId),
          name: "Example Person",
          organisation: null,
          workEmail: "person@example.invalid",
          role: null,
          goal: "Clearly artificial non-production enquiry fixture.",
          timeframe: null,
          budgetRange: null,
          intent: "project",
          offerSlug: null,
          sourcePath: "/contact",
          utm: {},
          receivedAt: "2026-10-11T09:00:00Z",
        },
      },
    ]);
    const [item] = await new SupabaseOutboxStore(client).claimBatch(5);
    expect(item?.correlationId).toBeUndefined();
    expect(item?.enquiry.organisation).toBeUndefined();
    expect(item?.enquiry.workEmail).toBe("person@example.invalid");
    expect(client.rpc).toHaveBeenCalledWith("claim_outbox_batch", { p_limit: 5 });
  });

  it("outbox marks call mark_outbox with state, error code and retry delay", async () => {
    const client = rpcReturning(true);
    const store = new SupabaseOutboxStore(client);
    await store.markSent("id-1", 1);
    await store.scheduleRetry("id-2", 2, 119.6, "timeout");
    await store.markFailed("id-3", 3, "recipient-rejected");
    expect(client.rpc.mock.calls.map(([fn, args]) => [fn, args])).toEqual([
      [
        "mark_outbox",
        { p_id: "id-1", p_attempts: 1, p_state: "sent", p_error: null, p_retry_in_seconds: 0 },
      ],
      [
        "mark_outbox",
        {
          p_id: "id-2",
          p_attempts: 2,
          p_state: "pending",
          p_error: "timeout",
          p_retry_in_seconds: 120,
        },
      ],
      [
        "mark_outbox",
        {
          p_id: "id-3",
          p_attempts: 3,
          p_state: "failed",
          p_error: "recipient-rejected",
          p_retry_in_seconds: 0,
        },
      ],
    ]);
  });

  it("Postgres rate limiter passes the key and window and parses the decision", async () => {
    const client = rpcReturning({ allowed: false, retryAfterSeconds: 30 });
    const decision = await new PostgresRateLimiter(client).consume("k", {
      windowSeconds: 60,
      max: 3,
    });
    expect(decision).toEqual({ allowed: false, retryAfterSeconds: 30 });
    expect(client.rpc).toHaveBeenCalledWith("rate_limit_consume", {
      p_key: "k",
      p_window_seconds: 60,
      p_max: 3,
    });
  });
});

describe("idempotency lookup", () => {
  it("find_enquiry_reference returns the stored reference, or null for an unknown key", async () => {
    const id = crypto.randomUUID();
    const known = rpcReturning({ id, reference: referenceFromId(id), duplicate: true });
    expect(await new SupabaseEnquiryRepository(known).findByIdempotencyKey("k")).toEqual({
      id,
      reference: referenceFromId(id),
      duplicate: true,
    });
    expect(known.rpc).toHaveBeenCalledWith("find_enquiry_reference", { p_key: "k" });
    expect(
      await new SupabaseEnquiryRepository(rpcReturning(null)).findByIdempotencyKey("k"),
    ).toBeNull();
  });

  it("references carry 12 hex characters (48 bits)", () => {
    expect(referenceFromId("0a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3")).toBe("VIT-0A1B2C3D4E5F");
  });
});

describe("MemoryRateLimiter", () => {
  it("allows up to max per window, then denies with a retry-after, then resets", async () => {
    const clock = mutableClock(new Date("2026-10-11T09:00:10.000Z"));
    const limiter = new MemoryRateLimiter(clock);
    const opts = { windowSeconds: 60, max: 2 };
    expect((await limiter.consume("k", opts)).allowed).toBe(true);
    expect((await limiter.consume("k", opts)).allowed).toBe(true);
    const denied = await limiter.consume("k", opts);
    expect(denied).toEqual({ allowed: false, retryAfterSeconds: 50 });
    expect((await limiter.consume("other", opts)).allowed).toBe(true);
    clock.advance(50);
    expect((await limiter.consume("k", opts)).allowed).toBe(true);
  });
});

describe("TurnstileVerifier", () => {
  const json = (body: unknown) => Promise.resolve(Response.json(body));
  const make = (fetchImpl: typeof fetch) =>
    new TurnstileVerifier({
      secret: "fixture-secret-value",
      expectedHostname: "www.example.invalid",
      fetch: fetchImpl,
    });

  it("passed / failed / failed when the token is missing", async () => {
    const ok = make(() =>
      json({ success: true, hostname: "www.example.invalid", action: "enquiry" }),
    );
    expect(await ok.verify({ token: "t", ip: undefined })).toBe("passed");
    const bad = make(() => json({ success: false, "error-codes": ["invalid-input-response"] }));
    expect(await bad.verify({ token: "t", ip: "203.0.113.7" })).toBe("failed");
    expect(await ok.verify({ token: undefined, ip: undefined })).toBe("failed");
  });

  it("throws on a provider outage so the enquiry fails closed", async () => {
    const down = make(() => Promise.reject(new TypeError("offline")));
    await expect(down.verify({ token: "t", ip: undefined })).rejects.toThrow(
      "turnstile-unavailable",
    );
  });

  it("DisabledVerifier reports disabled", async () => {
    expect(await new DisabledVerifier().verify()).toBe("disabled");
  });
});

describe("notifier and logger", () => {
  it("ConsoleNotifier records reference and kind only", async () => {
    const logger = recordingLogger();
    await new ConsoleNotifier(logger).send({
      kind: "internal-notification",
      idempotencyKey: "k",
      correlationId: "corr-0001-fixture",
      enquiry: {
        id: "id",
        reference: "VIT-AAAAAAAA",
        name: "Example Person",
        organisation: undefined,
        workEmail: "person@example.invalid",
        role: undefined,
        goal: "Clearly artificial non-production enquiry fixture.",
        timeframe: undefined,
        budgetRange: undefined,
        intent: "project",
        offerSlug: undefined,
        sourcePath: undefined,
        receivedAt: "2026-10-11T09:00:00Z",
      },
    });
    const output = JSON.stringify(logger.lines);
    expect(output).toContain("VIT-AAAAAAAA");
    expect(output).not.toContain("person@example.invalid");
    expect(output).not.toContain("Example Person");
    expect(output).not.toContain("Clearly artificial");
  });

  it("the enquiry logger writes redacted structured JSON through the shared logger", () => {
    const lines: string[] = [];
    const logger = createEnquiryLogger({ env: "local", sink: (line) => lines.push(line) });
    logger.warn("enquiry.rejected", { reason: "honeypot", correlationId: "corr-0001-fixture" });
    logger.error("enquiry.unavailable", { errorCode: "23514", detail: "person@example.invalid" });
    const [first, second] = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(first).toMatchObject({
      severity: "warn",
      service: "vitalos-web",
      env: "local",
      event: "enquiry.rejected",
      reason: "honeypot",
    });
    expect(second).toMatchObject({ severity: "error", errorCode: "23514" });
    expect(lines.join("\n")).not.toContain("person@example.invalid");
  });
});
