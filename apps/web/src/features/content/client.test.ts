import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ContentNotFoundError, ContentUnavailableError, createContentClient } from "./client";
import { HealthResponse, SiteState, TickResponse } from "./schemas";
import { verifyRequest } from "./signing";

const readKey = { id: "web-read-test", secret: "r".repeat(40) };
const submitKey = { id: "web-submit-test", secret: "s".repeat(40) };
const base = "https://admin.example.test";
const siteState = JSON.parse(
  readFileSync(
    new URL("../../../../../contracts/content-api/v1/fixtures/site-state.json", import.meta.url),
    "utf8",
  ),
) as unknown;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function harness(responses: (() => Promise<Response> | Response)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const queue = [...responses];
  const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = queue.shift();
    if (!next) throw new Error("unexpected fetch");
    return Promise.resolve(next());
  });
  const lines: Record<string, unknown>[] = [];
  const logger = {
    info: (event: string, fields?: Record<string, unknown>) => lines.push({ event, ...fields }),
    warn: (event: string, fields?: Record<string, unknown>) => lines.push({ event, ...fields }),
  };
  const client = createContentClient({
    baseUrl: base,
    readKey,
    submitKey,
    fetch: fetchMock as unknown as typeof fetch,
    logger,
    timeoutMs: 50,
    sleep: () => Promise.resolve(),
  });
  return { client, calls, fetchMock, lines };
}

describe("content client", () => {
  it("signs a GET with the read key over the exact path and query, and validates the body", async () => {
    const { client, calls } = harness([() => json(siteState)]);
    const data = await client.get("/api/content/v1/insights/posts?page=2&topic=x", SiteState);
    expect(data).toEqual(siteState);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(`${base}/api/content/v1/insights/posts?page=2&topic=x`);
    expect(call.init.method).toBe("GET");
    const headers = new Headers(call.init.headers as Record<string, string>);
    expect(
      verifyRequest({
        headers,
        keys: [readKey],
        scope: "read",
        method: "GET",
        pathAndQuery: "/api/content/v1/insights/posts?page=2&topic=x",
        body: "",
      }),
    ).toEqual({ ok: true, keyId: "web-read-test" });
  });

  it("signs a POST with the given scope and the raw body", async () => {
    const { client, calls } = harness([
      () => json({ promoted: 1, closed: 0, delivered: 2, nextDueAt: null }),
    ]);
    await client.post("/api/content/v1/tick", {}, TickResponse, { scope: "tick" });
    const call = calls[0]!;
    expect(call.init.body).toBe("{}");
    const headers = new Headers(call.init.headers as Record<string, string>);
    expect(headers.get("content-type")).toBe("application/json");
    expect(
      verifyRequest({
        headers,
        keys: [readKey],
        scope: "tick",
        method: "POST",
        pathAndQuery: "/api/content/v1/tick",
        body: "{}",
      }).ok,
    ).toBe(true);
  });

  it("uses the submit key for the submit scope and refuses when it is missing", async () => {
    const { client, calls } = harness([() => json({ status: "ok" })]);
    await client.post("/api/careers/v1/applications", {}, HealthResponse, { scope: "submit" });
    const headers = new Headers(calls[0]!.init.headers as Record<string, string>);
    expect(headers.get("x-vitalos-key-id")).toBe("web-submit-test");

    const noSubmit = createContentClient({
      baseUrl: base,
      readKey,
      fetch: vi.fn() as unknown as typeof fetch,
    });
    await expect(
      noSubmit.post("/api/careers/v1/applications", {}, SiteState, { scope: "submit" }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("404 is ContentNotFoundError, with no retry", async () => {
    const { client, fetchMock } = harness([() => json({ error: "not found" }, 404)]);
    await expect(client.get("/api/content/v1/home", SiteState)).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx exactly once and then succeeds", async () => {
    const { client, fetchMock } = harness([() => json({}, 503), () => json(siteState)]);
    await expect(client.get("/api/content/v1/site-state", SiteState)).resolves.toEqual(siteState);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry on repeated 5xx", async () => {
    const { client, fetchMock } = harness([() => json({}, 500), () => json({}, 502)]);
    const error = await client.get("/api/content/v1/site-state", SiteState).catch((e) => e);
    expect(error).toBeInstanceOf(ContentUnavailableError);
    expect(error).toMatchObject({ code: "http_5xx", status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error once", async () => {
    const { client, fetchMock } = harness([
      () => Promise.reject(new TypeError("fetch failed")),
      () => json(siteState),
    ]);
    await expect(client.get("/api/content/v1/site-state", SiteState)).resolves.toEqual(siteState);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const failing = harness([
      () => Promise.reject(new TypeError("fetch failed")),
      () => Promise.reject(new TypeError("fetch failed")),
    ]);
    await expect(failing.client.get("/api/content/v1/site-state", SiteState)).rejects.toMatchObject(
      { code: "network" },
    );
  });

  it("times out each attempt and retries once", async () => {
    const hang = () => new Promise<Response>(() => undefined);
    const calls: AbortSignal[] = [];
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      calls.push(signal);
      return new Promise<Response>((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        void hang();
      });
    });
    const client = createContentClient({
      baseUrl: base,
      readKey,
      fetch: fetchMock as unknown as typeof fetch,
      timeoutMs: 20,
      sleep: () => Promise.resolve(),
    });
    await expect(client.get("/api/content/v1/site-state", SiteState)).rejects.toMatchObject({
      code: "timeout",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls.every((signal) => signal.aborted)).toBe(true);
  });

  it("an invalid payload is unavailable and not retried", async () => {
    const { client, fetchMock } = harness([() => json({ insightsOpen: "yes" })]);
    await expect(client.get("/api/content/v1/site-state", SiteState)).rejects.toMatchObject({
      code: "invalid_payload",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const notJson = harness([() => new Response("<html>", { status: 200 })]);
    await expect(notJson.client.get("/api/content/v1/site-state", SiteState)).rejects.toMatchObject(
      { code: "invalid_payload" },
    );
  });

  it("other 4xx (for example a refused signature) are unavailable and not retried", async () => {
    const { client, fetchMock } = harness([() => json({ error: "unauthorized" }, 401)]);
    await expect(client.get("/api/content/v1/site-state", SiteState)).rejects.toMatchObject({
      code: "http_4xx",
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes extra headers such as the preview token", async () => {
    const { client, calls } = harness([() => json(siteState)]);
    await client.get("/api/content/v1/site-state", SiteState, {
      headers: { "x-vitalos-preview-token": "token-value" },
    });
    const headers = new Headers(calls[0]!.init.headers as Record<string, string>);
    expect(headers.get("x-vitalos-preview-token")).toBe("token-value");
  });

  it("logs endpoint, status, attempt and timing only: no query, body or headers", async () => {
    const { client, lines } = harness([() => json({}, 500), () => json(siteState)]);
    await client.get("/api/content/v1/insights/posts?author=secret-author", SiteState);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(
        expect.arrayContaining(["attempt", "durationMs", "endpoint", "event", "method"]),
      );
      expect(line["endpoint"]).toBe("/api/content/v1/insights/posts");
    }
    const text = JSON.stringify(lines);
    expect(text).not.toContain("secret-author");
    expect(text).not.toContain("Engineering clarity");
    expect(text).not.toContain(readKey.secret);
  });
});
