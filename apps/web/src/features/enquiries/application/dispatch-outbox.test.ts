import { describe, expect, it, vi } from "vitest";
import { MemoryOutboxStore } from "../adapters/memory-outbox";
import { MemoryEnquiryRepository } from "../adapters/memory-repository";
import { NotificationError } from "../domain/ports";
import type { NewEnquiry } from "../domain/enquiry";
import type { Notifier, NotificationMessage } from "../domain/ports";
import { mutableClock, piiMarkers, recordingLogger, validBody } from "../test-support";
import { backoffSeconds, defaultDispatchOptions, dispatchOutbox } from "./dispatch-outbox";
import { enquirySchemaV2 } from "@vitalos/validation/enquiry";

async function seed(clock = mutableClock()) {
  const repository = new MemoryEnquiryRepository(clock);
  const store = new MemoryOutboxStore(repository, clock);
  const details = enquirySchemaV2.parse(validBody());
  const { turnstileToken: _t, website: _w, ...rest } = details;
  void _t;
  void _w;
  const enquiry: NewEnquiry = { ...rest, ipHash: undefined, correlationId: "corr-0001-fixture" };
  await repository.submit(enquiry);
  return { clock, repository, store, logger: recordingLogger() };
}

const failing = (error: unknown): Notifier => ({ send: () => Promise.reject(error) });

describe("backoffSeconds", () => {
  it("doubles from the base and caps at the maximum", () => {
    const options = { ...defaultDispatchOptions, baseDelaySeconds: 60, maxDelaySeconds: 600 };
    expect([1, 2, 3, 4, 5, 6].map((attempt) => backoffSeconds(attempt, options))).toEqual([
      60, 120, 240, 480, 600, 600,
    ]);
  });
});

describe("dispatchOutbox", () => {
  it("sends the notification and marks the row sent", async () => {
    const { store, repository, logger } = await seed();
    const send = vi.fn<Notifier["send"]>(() => Promise.resolve());
    const summary = await dispatchOutbox({ store, notifier: { send }, logger });
    expect(summary).toEqual({ claimed: 1, sent: 1, retried: 0, failed: 0 });
    expect(repository.outbox[0]?.state).toBe("sent");
    const message = send.mock.calls[0]?.[0] as NotificationMessage;
    expect(message.kind).toBe("internal-notification");
    expect(message.idempotencyKey).toBe(`${message.enquiry.id}:internal-notification`);
  });

  it("is idempotent per enquiry and kind: a sent row is never sent again", async () => {
    const { store, logger } = await seed();
    const send = vi.fn<Notifier["send"]>(() => Promise.resolve());
    await dispatchOutbox({ store, notifier: { send }, logger });
    const second = await dispatchOutbox({ store, notifier: { send }, logger });
    expect(second.claimed).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("retries with exponential backoff and keeps the enquiry stored", async () => {
    const { store, repository, clock, logger } = await seed();
    const options = { maxAttempts: 4, baseDelaySeconds: 60 };
    const notifier = failing(new NotificationError("provider-unavailable", { retryable: true }));

    expect(await dispatchOutbox({ store, notifier, logger }, options)).toMatchObject({
      retried: 1,
    });
    const row = repository.outbox[0];
    expect(row?.state).toBe("pending");
    expect(row?.lastError).toBe("provider-unavailable");
    expect(row?.availableAt.getTime()).toBe(clock.now().getTime() + 60_000);

    // Not due yet: nothing is claimed.
    expect(await dispatchOutbox({ store, notifier, logger }, options)).toMatchObject({
      claimed: 0,
    });

    clock.advance(60);
    await dispatchOutbox({ store, notifier, logger }, options);
    expect(row?.availableAt.getTime()).toBe(clock.now().getTime() + 120_000);
    expect(repository.enquiries.size).toBe(1);
  });

  it("dead-letters after the maximum attempts and stops retrying", async () => {
    const { store, repository, clock, logger } = await seed();
    const notifier = failing(new NotificationError("provider-unavailable", { retryable: true }));
    const options = { maxAttempts: 3, baseDelaySeconds: 10 };
    const outcomes = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      outcomes.push(await dispatchOutbox({ store, notifier, logger }, options));
      clock.advance(3600);
    }
    expect(outcomes.map((o) => [o.claimed, o.retried, o.failed])).toEqual([
      [1, 1, 0],
      [1, 1, 0],
      [1, 0, 1],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(repository.outbox[0]).toMatchObject({ state: "failed", attempts: 3 });
    expect(logger.lines.some((l) => l.event === "outbox.dead_letter")).toBe(true);
  });

  it("dead-letters immediately on a non-retryable error", async () => {
    const { store, repository, logger } = await seed();
    const notifier = failing(new NotificationError("recipient-rejected", { retryable: false }));
    expect(await dispatchOutbox({ store, notifier, logger })).toMatchObject({
      failed: 1,
      retried: 0,
    });
    expect(repository.outbox[0]).toMatchObject({
      state: "failed",
      lastError: "recipient-rejected",
    });
  });

  it("stores only the error class for unknown errors, never the message", async () => {
    const { store, repository, logger } = await seed();
    const notifier = failing(new TypeError("could not deliver to person@example.invalid"));
    await dispatchOutbox({ store, notifier, logger });
    expect(repository.outbox[0]?.lastError).toBe("TypeError");
    expect(JSON.stringify(logger.lines)).not.toContain("person@example.invalid");
  });

  it("recovers a crashed worker: an expired lease is claimed again", async () => {
    const { store, repository, clock, logger } = await seed();
    const claimed = await store.claimBatch(10);
    expect(claimed).toHaveLength(1);
    expect(
      await dispatchOutbox({ store, notifier: { send: () => Promise.resolve() }, logger }),
    ).toMatchObject({
      claimed: 0,
    });
    clock.advance(301);
    const send = vi.fn<Notifier["send"]>(() => Promise.resolve());
    const summary = await dispatchOutbox({ store, notifier: { send }, logger });
    expect(summary).toMatchObject({ claimed: 1, sent: 1 });
    expect(repository.outbox[0]?.attempts).toBe(2);
  });

  it("a stale worker cannot overwrite a re-claimed row (attempts is the lease token)", async () => {
    const { store, repository, clock } = await seed();
    const [stale] = await store.claimBatch(10);
    clock.advance(301);
    const [current] = await store.claimBatch(10);
    expect(stale?.attempts).toBe(1);
    expect(current?.attempts).toBe(2);

    await store.markSent(stale!.id, stale!.attempts);
    await store.markFailed(stale!.id, stale!.attempts, "stale");
    await store.scheduleRetry(stale!.id, stale!.attempts, 60, "stale");
    expect(repository.outbox[0]).toMatchObject({ state: "processing", attempts: 2 });

    await store.markSent(current!.id, current!.attempts);
    expect(repository.outbox[0]?.state).toBe("sent");
  });

  it("dead-letters a row whose lease expired more often than the attempt budget", async () => {
    const { store, repository, clock, logger } = await seed();
    const send = vi.fn<Notifier["send"]>(() => Promise.resolve());
    for (let i = 0; i < 3; i += 1) {
      await store.claimBatch(10);
      clock.advance(301);
    }
    const summary = await dispatchOutbox({ store, notifier: { send }, logger }, { maxAttempts: 3 });
    expect(summary).toMatchObject({ failed: 1, sent: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(repository.outbox[0]?.lastError).toBe("max-attempts-exceeded");
  });

  it("survives a failure to record the result and never double counts it as sent", async () => {
    const { store, logger } = await seed();
    vi.spyOn(store, "markSent").mockRejectedValueOnce(new Error("db down"));
    const summary = await dispatchOutbox({
      store,
      notifier: { send: () => Promise.resolve() },
      logger,
    });
    expect(summary).toMatchObject({ claimed: 1, sent: 0, retried: 0, failed: 0 });
    expect(logger.lines.some((l) => l.event === "outbox.mark_failed")).toBe(true);
  });

  it("never logs personal data", async () => {
    const { store, logger } = await seed();
    await dispatchOutbox({ store, notifier: failing(new Error("x")), logger });
    await dispatchOutbox({ store, notifier: { send: () => Promise.resolve() }, logger });
    const output = JSON.stringify(logger.lines);
    for (const marker of piiMarkers) expect(output).not.toContain(marker);
  });
});
