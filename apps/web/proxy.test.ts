import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("proxy", () => {
  it("assigns a request id when none is supplied", () => {
    const response = proxy(new NextRequest("http://localhost:3000/"));
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps a well-formed inbound request id", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/", { headers: { "x-request-id": "edge-abc-123456" } }),
    );
    expect(response.headers.get("x-request-id")).toBe("edge-abc-123456");
  });

  it("replaces a malformed inbound request id", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/", {
        headers: { "x-request-id": "bad id\twith space" },
      }),
    );
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
