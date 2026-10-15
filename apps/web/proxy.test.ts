import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const isMissing = vi.fn((pathname: string) => Promise.resolve(pathname === "/solutions/nope"));
const isMissingLegacy = vi.fn((pathname: string) => Promise.resolve(pathname === "/careers/nope"));
vi.mock("./src/features/missing-documents", () => ({
  UNMATCHED_PATH: "/__unmatched__",
  isMissingDetailPath: (pathname: string) => isMissing(pathname),
  isMissingLegacyContentPath: (pathname: string) => isMissingLegacy(pathname),
}));

type ContentResult =
  "not-applicable" | "legacy" | "pass" | "missing" | "unavailable" | { redirect: string };
const contentDecision = vi.fn((request: NextRequest): Promise<ContentResult> =>
  Promise.resolve(
    request.method !== "GET"
      ? "not-applicable"
      : request.nextUrl.pathname.startsWith("/careers")
        ? "legacy"
        : request.nextUrl.pathname.startsWith("/insights")
          ? "missing"
          : "not-applicable",
  ),
);
vi.mock("./src/features/content/proxy", async (importOriginal) => {
  const original = await importOriginal<typeof import("./src/features/content/proxy")>();
  return {
    ...original,
    contentProxyDecision: (request: NextRequest) => contentDecision(request),
  };
});

const { proxy } = await import("./proxy");

describe("proxy", () => {
  it("assigns a request id when none is supplied", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/"));
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps a well-formed inbound request id", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/", { headers: { "x-request-id": "edge-abc-123456" } }),
    );
    expect(response.headers.get("x-request-id")).toBe("edge-abc-123456");
  });

  it("replaces a malformed inbound request id", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/", {
        headers: { "x-request-id": "bad id\twith space" },
      }),
    );
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rewrites a missing detail document onto an unmatched path and keeps the request id", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/solutions/nope", {
        headers: { "x-request-id": "edge-abc-123456" },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/__unmatched__",
    );
    expect(response.headers.get("x-request-id")).toBe("edge-abc-123456");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("leaves an existing document, and other methods alone", async () => {
    isMissing.mockClear();
    const existing = await proxy(new NextRequest("http://localhost:3000/solutions/real"));
    expect(existing.headers.get("x-middleware-rewrite")).toBeNull();
    const post = await proxy(
      new NextRequest("http://localhost:3000/solutions/nope", { method: "POST" }),
    );
    expect(post.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("proxy: Insights and Careers (ADR-036)", () => {
  const request = (path: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) =>
    new NextRequest(`http://localhost:3000${path}`, {
      headers: { "x-request-id": "edge-abc-123456" },
      ...init,
    });

  it("308s an old slug to the current one, without caching", async () => {
    contentDecision.mockResolvedValueOnce({ redirect: "/insights/new-slug" });
    const response = await proxy(request("/insights/old-slug"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost:3000/insights/new-slug");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("edge-abc-123456");
  });

  it("rewrites a missing item or closed section to the server-rendered 404", async () => {
    contentDecision.mockResolvedValueOnce("missing");
    const response = await proxy(request("/careers/gone"));
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/__unmatched__",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 503 with Retry-After and a plain HTML page when the admin is unavailable", async () => {
    contentDecision.mockResolvedValueOnce("unavailable");
    const response = await proxy(request("/insights/uncached"));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("x-request-id")).toBe("edge-abc-123456");
    const html = await response.text();
    expect(html).toContain('<html lang="en-GB">');
    expect(html).toContain("<h1>Temporarily unavailable</h1>");
    expect(html).toContain(
      "This page is temporarily unavailable. Please try again in a few minutes.",
    );
    expect(html).not.toMatch(/<script|<link|<img/);
  });

  it("passes an ok verdict (and a failed lookup) through to the page", async () => {
    contentDecision.mockResolvedValueOnce("pass");
    const response = await proxy(request("/insights/live"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(isMissing).not.toHaveBeenCalledWith("/insights/live");
  });

  it("keeps the CMS check for Careers while the content API is not configured", async () => {
    const missing = await proxy(request("/careers/nope"));
    expect(missing.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/__unmatched__");
    const present = await proxy(request("/careers/real"));
    expect(present.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("answers the server-rendered 404 for Insights while it is closed", async () => {
    const response = await proxy(request("/insights"));
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/__unmatched__",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("asks nothing about other paths", async () => {
    isMissingLegacy.mockClear();
    await proxy(request("/solutions/real"));
    expect(isMissingLegacy).not.toHaveBeenCalled();
  });
});
