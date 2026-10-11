import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The seed redirect map has no 410 rules, so the gone lookup is stubbed for this test.
vi.mock("./src/features/redirects/gone", async (importOriginal) => {
  const original = await importOriginal<typeof import("./src/features/redirects/gone")>();
  return { ...original, isGone: (pathname: string) => pathname === "/retired" };
});

const { proxy } = await import("./proxy");

describe("proxy: retired paths", () => {
  it("answers 410 Gone and still echoes the correlation id", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/retired", {
        headers: { "x-request-id": "edge-abc-123456" },
      }),
    );
    expect(response.status).toBe(410);
    expect(response.headers.get("x-request-id")).toBe("edge-abc-123456");
    expect(await response.text()).toBe("Gone");
  });

  it("passes every other path through", async () => {
    expect((await proxy(new NextRequest("http://localhost:3000/what-we-do"))).status).toBe(200);
  });
});
