import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const isMissing = vi.fn((pathname: string) => Promise.resolve(pathname === "/solutions/nope"));
vi.mock("./src/features/missing-documents", () => ({
  UNMATCHED_PATH: "/__unmatched__",
  isMissingDetailPath: (pathname: string) => isMissing(pathname),
}));

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

  it("leaves an existing document, other methods and Draft Mode requests alone", async () => {
    isMissing.mockClear();
    const existing = await proxy(new NextRequest("http://localhost:3000/solutions/real"));
    expect(existing.headers.get("x-middleware-rewrite")).toBeNull();
    const post = await proxy(
      new NextRequest("http://localhost:3000/solutions/nope", { method: "POST" }),
    );
    expect(post.headers.get("x-middleware-rewrite")).toBeNull();
    isMissing.mockClear();
    const draft = await proxy(
      new NextRequest("http://localhost:3000/solutions/nope", {
        headers: { cookie: "__prerender_bypass=abc" },
      }),
    );
    expect(draft.headers.get("x-middleware-rewrite")).toBeNull();
    expect(isMissing).not.toHaveBeenCalled();
  });
});
