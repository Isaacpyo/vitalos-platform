import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const isMissing = vi.fn((pathname: string) => Promise.resolve(pathname === "/solutions/nope"));
vi.mock("./src/features/missing-documents", () => ({
  UNMATCHED_PATH: "/__unmatched__",
  isMissingDetailPath: (pathname: string) => isMissing(pathname),
}));

type ContentResult = "not-applicable" | "pass" | "missing" | "unavailable" | { redirect: string };
const contentDecision = vi.fn((request: NextRequest): Promise<ContentResult> =>
  Promise.resolve(
    request.method !== "GET"
      ? "not-applicable"
      : /^\/(insights|careers)(\/|$)/.test(request.nextUrl.pathname)
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
  it("redirects a path with capital letters to its lowercase form with a 308, query kept", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/What-We-Do?intent=ai"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost:3000/what-we-do?intent=ai");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("leaves lowercase paths, API routes and framework assets alone", async () => {
    for (const path of ["/what-we-do", "/api/Health", "/_next/static/A.js"]) {
      const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
      expect(response.status, path).not.toBe(308);
    }
  });

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

describe("proxy: Insights and Careers (ADR-040)", () => {
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

  it("answers the server-rendered 404 for Insights and Careers while they are closed", async () => {
    for (const path of ["/insights", "/careers", "/careers/a-role"]) {
      const response = await proxy(request(path));
      expect(response.headers.get("x-middleware-rewrite"), path).toBe(
        "http://localhost:3000/__unmatched__",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("never asks the CMS about Insights or Careers", async () => {
    isMissing.mockClear();
    await proxy(request("/careers/a-role"));
    await proxy(request("/insights/a-post"));
    expect(isMissing).not.toHaveBeenCalled();
  });
});
