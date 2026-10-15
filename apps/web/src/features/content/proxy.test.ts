import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyLookup } from "./lookup/auth";

const readSecret = "r".repeat(40);
const env = {
  configured: true,
};
vi.mock("@vitalos/config", () => ({
  getEnv: () => ({
    siteUrl: "https://www.example.test",
    content: env.configured
      ? { apiBaseUrl: "https://admin.example.test", readKey: { id: "read", secret: readSecret } }
      : { apiBaseUrl: undefined, readKey: undefined },
  }),
}));

const { contentProxyDecision, lookupOrigin, unavailableResponse } = await import("./proxy");
const { clearProxyLookupVerdicts } = await import("./lookup/proxy-lookup");

const fetchMock = vi.fn();
beforeEach(() => {
  env.configured = true;
  clearProxyLookupVerdicts();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const verdictResponse = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("contentProxyDecision", () => {
  it("is not applicable to other paths and methods", async () => {
    expect(await contentProxyDecision(new NextRequest("https://www.example.test/about"))).toBe(
      "not-applicable",
    );
    expect(
      await contentProxyDecision(
        new NextRequest("https://www.example.test/insights/a", { method: "POST" }),
      ),
    ).toBe("not-applicable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes Insights and keeps the legacy CMS check for Careers when not configured", async () => {
    env.configured = false;
    expect(await contentProxyDecision(new NextRequest("https://www.example.test/insights/a"))).toBe(
      "missing",
    );
    expect(await contentProxyDecision(new NextRequest("https://www.example.test/insights"))).toBe(
      "missing",
    );
    expect(await contentProxyDecision(new NextRequest("https://www.example.test/careers/a"))).toBe(
      "legacy",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets Draft Mode requests through without a lookup", async () => {
    const request = new NextRequest("https://www.example.test/insights/a", {
      headers: { cookie: "__prerender_bypass=abc" },
    });
    expect(await contentProxyDecision(request)).toBe("pass");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the lookup route on this deployment with a signed header and maps the verdict", async () => {
    fetchMock.mockReturnValueOnce(
      verdictResponse({ verdict: "redirect", location: "/insights/b" }),
    );
    const decision = await contentProxyDecision(
      new NextRequest("https://www.example.test/insights/a"),
    );
    expect(decision).toEqual({ redirect: "/insights/b" });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://www.example.test/api/content/lookup?path=%2Finsights%2Fa");
    const header = new Headers(init.headers).get("x-vitalos-lookup");
    expect(verifyLookup(readSecret, header, "/insights/a")).toBe(true);

    fetchMock.mockReturnValueOnce(verdictResponse({ verdict: "missing" }));
    expect(await contentProxyDecision(new NextRequest("https://www.example.test/careers/x"))).toBe(
      "missing",
    );
    fetchMock.mockReturnValueOnce(verdictResponse({ verdict: "unavailable" }));
    expect(await contentProxyDecision(new NextRequest("https://www.example.test/careers"))).toBe(
      "unavailable",
    );
    fetchMock.mockReturnValueOnce(verdictResponse({ verdict: "ok" }));
    expect(await contentProxyDecision(new NextRequest("https://www.example.test/insights"))).toBe(
      "pass",
    );
  });

  it("passes through when the lookup fails or answers nonsense", async () => {
    fetchMock.mockReturnValueOnce(verdictResponse({ error: "x" }, 500));
    expect(
      await contentProxyDecision(new NextRequest("https://www.example.test/insights/e1")),
    ).toBe("pass");
    fetchMock.mockReturnValueOnce(
      verdictResponse({ verdict: "redirect", location: "https://evil.example" }),
    );
    expect(
      await contentProxyDecision(new NextRequest("https://www.example.test/insights/e2")),
    ).toBe("pass");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(
      await contentProxyDecision(new NextRequest("https://www.example.test/insights/e3")),
    ).toBe("pass");
  });
});

describe("lookupOrigin", () => {
  it("uses the request origin only for the site, the deployment or a local host", () => {
    const site = "https://www.example.test";
    expect(lookupOrigin("https://www.example.test", site)).toBe(site);
    expect(lookupOrigin("http://127.0.0.1:3210", site)).toBe("http://127.0.0.1:3210");
    expect(lookupOrigin("http://localhost:3000", site)).toBe("http://localhost:3000");
    expect(lookupOrigin("https://evil.example", site)).toBe(site);
  });
});

describe("unavailableResponse", () => {
  it("is a 503 with Retry-After, no-store and a plain page", async () => {
    const response = unavailableResponse("req-12345678");
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("Please try again in a few minutes.");
  });
});
