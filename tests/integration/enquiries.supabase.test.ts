/**
 * Enquiry pipeline against a LOCAL Supabase stack (never a remote project).
 *
 * Skipped unless SUPABASE_URL and SUPABASE_SECRET_KEY point at a reachable local stack. To run:
 *
 *   supabase start && supabase db reset          # local only
 *   supabase status -o env                        # copy API_URL / SECRET_KEY / ANON_KEY
 *   SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> SUPABASE_ANON_KEY=<ANON_KEY> \
 *     corepack pnpm test:integration
 *
 * Without Docker the suite is skipped and reports as such. It writes artificial rows only
 * (`*.invalid` addresses) and removes them afterwards.
 */
import { afterAll, describe, expect, it, vi } from "vitest";
import { artificialEnquiryBody } from "../../packages/testing/src/enquiry";
import { PostgresRateLimiter } from "../../apps/web/src/features/enquiries/adapters/postgres-rate-limiter";
import { SupabaseOutboxStore } from "../../apps/web/src/features/enquiries/adapters/supabase-outbox";
import { createSupabaseRpcClient } from "../../apps/web/src/features/enquiries/adapters/supabase-rpc";
import { createEnquiryService } from "../../apps/web/src/features/enquiries/composition";
import { handleEnquiryRequest } from "../../apps/web/src/features/enquiries/http/handle-enquiry-request";
import { recordingLogger } from "../../apps/web/src/features/enquiries/test-support";

vi.mock("server-only", () => ({}));

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

const isLocal = (value: string | undefined) =>
  value !== undefined && /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(value);

async function reachable(): Promise<boolean> {
  if (!url || !secretKey || !isLocal(url)) return false;
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: secretKey },
      signal: AbortSignal.timeout(10_000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

const enabled = await reachable();
const siteOrigin = "https://www.example.invalid";

describe.skipIf(!enabled)("enquiry pipeline on local Supabase", () => {
  const base = url as string;
  const key = secretKey as string;
  const createdIds: string[] = [];

  const rest = (path: string, init: RequestInit = {}, apikey = key) =>
    fetch(`${base}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey,
        authorization: `Bearer ${apikey}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });

  const env = (overrides: Record<string, unknown> = {}) =>
    ({
      deployEnv: "local",
      siteUrl: siteOrigin,
      supabase: { url: base, secretKey: key },
      turnstile: { siteKey: undefined, secretKey: undefined },
      enquiry: {
        backend: "supabase",
        notificationTo: undefined,
        ipHashSalt: "integration-salt-0123456789",
        outboxDispatchSecret: undefined,
      },
      email: { provider: "console", apiKey: undefined, from: undefined },
      ...overrides,
    }) as never;

  const post = (service: ReturnType<typeof createEnquiryService>, body: unknown, ip: string) => {
    const tasks: (() => Promise<unknown>)[] = [];
    return handleEnquiryRequest(
      new Request(`${siteOrigin}/api/enquiries`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: siteOrigin,
          "x-forwarded-for": ip,
        },
        body: JSON.stringify(body),
      }),
      { service, siteOrigin, after: (task) => void tasks.push(task) },
    ).then((response) => ({ response, tasks }));
  };

  afterAll(async () => {
    if (createdIds.length === 0) return;
    const ids = `(${createdIds.join(",")})`;
    await rest(`notification_outbox?enquiry_id=in.${ids}`, { method: "DELETE" });
    await rest(`enquiries?id=in.${ids}`, { method: "DELETE" });
  });

  it("stores the enquiry and its outbox row, hashes the IP, and is idempotent", async () => {
    const logger = recordingLogger();
    const service = createEnquiryService(env(), {
      logger,
      notifier: { send: () => Promise.resolve() },
    });
    const body = artificialEnquiryBody({
      utm: { source: "integration" },
      offerSlug: "example-offer",
    });

    const first = await post(service, body, "198.51.100.21");
    expect(first.response.status).toBe(202);
    const { reference } = (await first.response.json()) as { reference: string };
    expect(reference).toMatch(/^VIT-[0-9A-F]{12}$/);

    const rows = (await (
      await rest(`enquiries?idempotency_key=eq.${body.idempotencyKey as string}&select=*`)
    ).json()) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;
    createdIds.push(row.id as string);
    expect(reference).toBe(
      `VIT-${(row.id as string).replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    );
    expect(row).toMatchObject({
      email: "person@example.invalid",
      intent: "project",
      timeframe: "within-3-months",
      offer_slug: "example-offer",
      source_path: "/contact",
      utm: { source: "integration" },
      privacy_notice_version: "fixture-1",
      retention_until: null,
    });
    expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain("198.51.100.21");
    expect(row.consent_at).toBeTruthy();

    const outbox = (await (
      await rest(`notification_outbox?enquiry_id=eq.${row.id as string}&select=*`)
    ).json()) as Record<string, unknown>[];
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      kind: "internal-notification",
      event_type: "enquiry.received.v1",
      state: "pending",
    });
    expect(JSON.stringify(outbox[0]?.payload)).not.toContain("person@example.invalid");

    // Replay: same reference, nothing new stored.
    const replay = await post(
      service,
      { ...body, goal: "A different goal that the replay must not overwrite." },
      "198.51.100.21",
    );
    expect(replay.response.status).toBe(202);
    expect(((await replay.response.json()) as { reference: string }).reference).toBe(reference);
    const after = (await (
      await rest(`enquiries?idempotency_key=eq.${body.idempotencyKey as string}&select=id,message`)
    ).json()) as { message: string }[];
    expect(after).toHaveLength(1);
    expect(after[0]?.message).toContain("Clearly artificial");

    for (const line of logger.lines) {
      expect(JSON.stringify(line)).not.toContain("person@example.invalid");
      expect(JSON.stringify(line)).not.toContain("198.51.100.21");
    }
  });

  it("dispatches the outbox: pending -> sent, and a failure is retried, not lost", async () => {
    const sentFor: string[] = [];
    const service = createEnquiryService(env(), {
      notifier: {
        send: (message) => {
          sentFor.push(message.enquiry.reference);
          return Promise.resolve();
        },
      },
    });
    const body = artificialEnquiryBody();
    const created = await post(service, body, "198.51.100.22");
    const { reference } = (await created.response.json()) as { reference: string };
    const id = `${reference}`;
    const enquiry = (await (
      await rest(`enquiries?idempotency_key=eq.${body.idempotencyKey as string}&select=id`)
    ).json()) as { id: string }[];
    createdIds.push(enquiry[0]?.id as string);

    const summary = await service.dispatch();
    expect(summary?.sent).toBeGreaterThanOrEqual(1);
    expect(sentFor).toContain(id);
    const state = (await (
      await rest(
        `notification_outbox?enquiry_id=eq.${enquiry[0]?.id as string}&select=state,attempts,sent_at`,
      )
    ).json()) as { state: string; attempts: number; sent_at: string | null }[];
    expect(state[0]).toMatchObject({ state: "sent", attempts: 1 });
    expect(state[0]?.sent_at).toBeTruthy();

    // A failing notifier schedules a retry and the enquiry stays recoverable.
    const failing = createEnquiryService(env(), {
      notifier: { send: () => Promise.reject(new Error("provider down")) },
    });
    const failBody = artificialEnquiryBody();
    await post(failing, failBody, "198.51.100.23");
    const failEnquiry = (await (
      await rest(`enquiries?idempotency_key=eq.${failBody.idempotencyKey as string}&select=id`)
    ).json()) as { id: string }[];
    createdIds.push(failEnquiry[0]?.id as string);
    const failed = await failing.dispatch();
    expect(failed?.retried).toBeGreaterThanOrEqual(1);
    const pending = (await (
      await rest(
        `notification_outbox?enquiry_id=eq.${failEnquiry[0]?.id as string}&select=state,last_error,available_at`,
      )
    ).json()) as { state: string; last_error: string; available_at: string }[];
    expect(pending[0]).toMatchObject({ state: "pending", last_error: "Error" });
    expect(new Date(pending[0]?.available_at as string).getTime()).toBeGreaterThan(Date.now());
  });

  it("abuse: honeypot, extra keys and cross-origin POSTs store nothing", async () => {
    const service = createEnquiryService(env());
    const honeypot = artificialEnquiryBody({ website: "https://spam.invalid" });
    const extra = artificialEnquiryBody({ status: "closed" });
    expect((await post(service, honeypot, "198.51.100.24")).response.status).toBe(403);
    expect((await post(service, extra, "198.51.100.24")).response.status).toBe(403);
    const crossOrigin = await handleEnquiryRequest(
      new Request(`${siteOrigin}/api/enquiries`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.invalid" },
        body: JSON.stringify(artificialEnquiryBody()),
      }),
      { service, siteOrigin, after: () => undefined },
    );
    expect(crossOrigin.status).toBe(403);
    for (const body of [honeypot, extra]) {
      const rows = (await (
        await rest(`enquiries?idempotency_key=eq.${body.idempotencyKey as string}&select=id`)
      ).json()) as unknown[];
      expect(rows).toHaveLength(0);
    }
  });

  it("lease token: a stale worker cannot overwrite a re-claimed outbox row", async () => {
    const client = createSupabaseRpcClient({ url: base, secretKey: key });
    const store = new SupabaseOutboxStore(client);
    const service = createEnquiryService(env());
    const body = artificialEnquiryBody();
    const created = await post(service, body, "198.51.100.30");
    const { reference } = (await created.response.json()) as { reference: string };
    const enquiry = (await (
      await rest(`enquiries?idempotency_key=eq.${body.idempotencyKey as string}&select=id`)
    ).json()) as { id: string }[];
    const enquiryId = enquiry[0]?.id as string;
    createdIds.push(enquiryId);

    const first = (await store.claimBatch(50)).find((item) => item.enquiry.reference === reference);
    expect(first?.attempts).toBe(1);
    // The first worker's lease expires; a second worker re-claims the row.
    await rest(`notification_outbox?enquiry_id=eq.${enquiryId}`, {
      method: "PATCH",
      body: JSON.stringify({ locked_until: new Date(Date.now() - 1000).toISOString() }),
    });
    const second = (await store.claimBatch(50)).find(
      (item) => item.enquiry.reference === reference,
    );
    expect(second?.attempts).toBe(2);

    await store.markSent((first as { id: string }).id, 1); // stale token: ignored
    const rows = (await (
      await rest(`notification_outbox?enquiry_id=eq.${enquiryId}&select=state,attempts`)
    ).json()) as { state: string; attempts: number }[];
    expect(rows[0]).toMatchObject({ state: "processing", attempts: 2 });

    await store.markSent((second as { id: string }).id, 2);
    const done = (await (
      await rest(`notification_outbox?enquiry_id=eq.${enquiryId}&select=state`)
    ).json()) as { state: string }[];
    expect(done[0]?.state).toBe("sent");
  });

  it("a retry with a spent idempotency key returns the original reference without a human check", async () => {
    const verify = vi.fn();
    const service = createEnquiryService(
      env({ turnstile: { siteKey: "site-key-fixture", secretKey: "secret-key-fixture" } }),
      {
        fetch: ((...args: unknown[]) => {
          verify(...args);
          return Promise.resolve(
            Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] }),
          );
        }) as typeof fetch,
      },
    );
    const body = artificialEnquiryBody();
    // First submission is stored through a service without Turnstile.
    const plain = createEnquiryService(env());
    const first = await post(plain, body, "198.51.100.31");
    const { reference } = (await first.response.json()) as { reference: string };
    const enquiry = (await (
      await rest(`enquiries?idempotency_key=eq.${body.idempotencyKey as string}&select=id`)
    ).json()) as { id: string }[];
    createdIds.push(enquiry[0]?.id as string);

    // The Turnstile token is spent, but the replay is answered first.
    const replay = await post(service, { ...body, turnstileToken: "spent-token" }, "198.51.100.31");
    expect(replay.response.status).toBe(202);
    expect(((await replay.response.json()) as { reference: string }).reference).toBe(reference);
    expect(verify).not.toHaveBeenCalled();
  });

  it("unstorable input is a 400, never a 503", async () => {
    const service = createEnquiryService(env());
    const nul = await post(
      service,
      artificialEnquiryBody({ goal: `${"x".repeat(30)}${String.fromCharCode(0)}` }),
      "198.51.100.32",
    );
    expect(nul.response.status).toBe(400);
    const surrogate = await post(
      service,
      artificialEnquiryBody({ name: `Example${String.fromCharCode(0xd800)} Person` }),
      "198.51.100.32",
    );
    expect(surrogate.response.status).toBe(400);
  });

  it("Postgres rate limiter allows up to max, then denies with a retry-after", async () => {
    const limiter = new PostgresRateLimiter(createSupabaseRpcClient({ url: base, secretKey: key }));
    const limiterKey = `integration:${crypto.randomUUID()}`;
    const opts = { windowSeconds: 3600, max: 2 };
    expect((await limiter.consume(limiterKey, opts)).allowed).toBe(true);
    expect((await limiter.consume(limiterKey, opts)).allowed).toBe(true);
    const denied = await limiter.consume(limiterKey, opts);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    await rest(`rate_limit_buckets?key=eq.${limiterKey}`, { method: "DELETE" });
  });

  it.skipIf(!anonKey)("the public anon key cannot read tables or call the functions", async () => {
    const anon = anonKey as string;
    const read = await rest("enquiries?select=id", {}, anon);
    expect(read.ok).toBe(false);
    const outbox = await rest("notification_outbox?select=id", {}, anon);
    expect(outbox.ok).toBe(false);
    const submit = await fetch(`${base}/rest/v1/rpc/submit_enquiry`, {
      method: "POST",
      headers: {
        apikey: anon,
        authorization: `Bearer ${anon}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p: artificialEnquiryBody() }),
    });
    expect(submit.ok).toBe(false);
    const claim = await fetch(`${base}/rest/v1/rpc/claim_outbox_batch`, {
      method: "POST",
      headers: {
        apikey: anon,
        authorization: `Bearer ${anon}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_limit: 5 }),
    });
    expect(claim.ok).toBe(false);
  });
});
