import { describe, expect, it, vi } from "vitest";
import { enquirySchemaV2 } from "@vitalos/validation/enquiry";
import type { NewEnquiry } from "./domain/enquiry";
import type { EnquiryService } from "./composition";
import { MemoryEnquiryRepository } from "./adapters/memory-repository";
import { MemoryRetentionStore } from "./adapters/memory-retention";
import { SupabaseRetentionStore } from "./adapters/supabase-retention";
import { EnquiryStoreError } from "./adapters/supabase-rpc";
import type { RpcClient } from "./adapters/supabase-rpc";
import { purgeExpiredEnquiries } from "./application/purge-expired-enquiries";
import { handleRetentionRequest } from "./http/handle-retention-request";
import { mutableClock, piiMarkers, recordingLogger, validBody } from "./test-support";

const newEnquiry = (): NewEnquiry => {
  const {
    turnstileToken: _t,
    website: _w,
    ...rest
  } = enquirySchemaV2.parse(validBody({ idempotencyKey: crypto.randomUUID() }));
  void _t;
  void _w;
  return { ...rest, ipHash: undefined, correlationId: "corr-0001-fixture" };
};

describe("MemoryRetentionStore", () => {
  it("deletes enquiries and outbox rows after 24 months and keeps newer ones", async () => {
    const clock = mutableClock(new Date("2026-01-15T09:00:00.000Z"));
    const repository = new MemoryEnquiryRepository(clock);
    const store = new MemoryRetentionStore(repository, clock);
    await repository.submit(newEnquiry());
    clock.advance(60 * 60 * 24 * 365); // ~12 months later
    const kept = await repository.submit(newEnquiry());

    clock.advance(60 * 60 * 24 * 365); // first is now ~24 months old, not yet past
    expect(await store.purgeExpired()).toBe(0);

    clock.advance(60 * 60 * 24 * 40); // first is past 24 months, second is not
    expect(await store.purgeExpired()).toBe(1);
    expect([...repository.enquiries.keys()]).toEqual([kept.id]);
    expect(repository.outbox.map((row) => row.enquiryId)).toEqual([kept.id]);
    expect(await store.purgeExpired()).toBe(0);
  });
});

describe("SupabaseRetentionStore", () => {
  const client = (data: unknown, error: { code?: string } | null = null) =>
    ({ rpc: vi.fn<RpcClient["rpc"]>(() => Promise.resolve({ data, error })) }) satisfies RpcClient;

  it("calls purge_expired_enquiries and returns the count", async () => {
    const rpc = client(3);
    expect(await new SupabaseRetentionStore(rpc).purgeExpired()).toBe(3);
    expect(rpc.rpc).toHaveBeenCalledWith("purge_expired_enquiries", {});
  });

  it("rejects an unexpected result and maps errors to a code only", async () => {
    for (const bad of [null, "3", -1, 1.5]) {
      await expect(new SupabaseRetentionStore(client(bad)).purgeExpired()).rejects.toBeInstanceOf(
        EnquiryStoreError,
      );
    }
    const error = await new SupabaseRetentionStore(client(null, { code: "42501" }))
      .purgeExpired()
      .catch((e: unknown) => e);
    expect((error as EnquiryStoreError).message).toBe("42501");
  });
});

describe("purgeExpiredEnquiries", () => {
  it("logs the count only", async () => {
    const logger = recordingLogger();
    const result = await purgeExpiredEnquiries({
      store: { purgeExpired: () => Promise.resolve(4) },
      logger,
    });
    expect(result).toEqual({ purged: 4 });
    expect(logger.lines).toEqual([
      { level: "info", event: "retention.purged", fields: { purged: 4 } },
    ]);
    expect(JSON.stringify(logger.lines)).not.toContain(piiMarkers[0]);
  });
});

describe("handleRetentionRequest", () => {
  const secret = "s".repeat(40);
  const service = (overrides: Partial<EnquiryService> = {}): EnquiryService => ({
    available: true,
    receive: () => Promise.resolve({ kind: "unavailable" }),
    dispatch: () => Promise.resolve(null),
    purgeExpired: vi.fn(() => Promise.resolve({ purged: 2 })),
    ...overrides,
  });
  const request = (authorization?: string) =>
    new Request("https://www.example.invalid/api/internal/retention/purge", {
      method: "GET",
      headers: authorization ? { authorization } : {},
    });

  it("401 without or with a wrong bearer secret, and does not purge", async () => {
    const svc = service();
    for (const header of [undefined, "Bearer wrong", `Basic ${secret}`, "Bearer ", secret]) {
      const response = await handleRetentionRequest(request(header), {
        service: svc,
        secrets: [secret],
      });
      expect(response.status).toBe(401);
    }
    expect(svc.purgeExpired).not.toHaveBeenCalled();
  });

  it("200 with the count only, accepting either configured secret", async () => {
    const cron = "c".repeat(20);
    const deps = { service: service(), secrets: [secret, cron, undefined] };
    for (const token of [secret, cron]) {
      const response = await handleRetentionRequest(request(`Bearer ${token}`), deps);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok", purged: 2 });
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("503 when no secret is configured (never open by default)", async () => {
    const response = await handleRetentionRequest(request(`Bearer ${secret}`), {
      service: service(),
      secrets: [undefined],
    });
    expect(response.status).toBe(503);
  });

  it("503 when the backend is unavailable or the purge throws, with no detail", async () => {
    const down = await handleRetentionRequest(request(`Bearer ${secret}`), {
      service: service({ available: false }),
      secrets: [secret],
    });
    expect(down.status).toBe(503);
    const failing = await handleRetentionRequest(request(`Bearer ${secret}`), {
      service: service({ purgeExpired: () => Promise.reject(new EnquiryStoreError("42501")) }),
      secrets: [secret],
    });
    expect(failing.status).toBe(503);
    expect(await failing.json()).toEqual({ error: "unavailable" });
  });
});
