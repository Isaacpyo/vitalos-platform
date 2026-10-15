import { describe, expect, it } from "vitest";
import type { BuildEnv } from "@vitalos/config/build";
import { getSecurityHeaders } from "./security-headers";

const baseEnv: BuildEnv = {
  deployEnv: "production",
  siteUrl: "https://www.example.invalid",
  contentSource: "repo",
  indexable: true,
  enableHsts: false,
  turnstileEnabled: false,
  relayEnabled: false,
  relayRealtimeOrigin: undefined,
};

const headersFor = (env: Partial<BuildEnv>, isDev = false) => {
  const rules = getSecurityHeaders({ ...baseEnv, ...env }, { isDev });
  expect(rules).toHaveLength(1);
  expect(rules[0]!.source).toBe("/:path*");
  return new Map(rules[0]!.headers.map((header) => [header.key, header.value]));
};

describe("getSecurityHeaders", () => {
  it("adds the Relay realtime origin to connect-src only when configured", () => {
    const off = headersFor({}).get("Content-Security-Policy") ?? "";
    expect(off).toContain("connect-src 'self';");
    const on =
      headersFor({ relayEnabled: true, relayRealtimeOrigin: "wss://project.supabase.co" }).get(
        "Content-Security-Policy",
      ) ?? "";
    expect(on).toContain("connect-src 'self' wss://project.supabase.co;");
  });

  it.each(["local", "preview", "staging"] as const)("noindexes %s", (deployEnv) => {
    expect(headersFor({ deployEnv, indexable: false }).get("X-Robots-Tag")).toBe(
      "noindex, nofollow",
    );
  });

  it("does not noindex production", () => {
    expect(headersFor({}).has("X-Robots-Tag")).toBe(false);
  });

  it("production CSP: no framing, no external connections, no Turnstile", () => {
    const csp = headersFor({}).get("Content-Security-Policy")!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self';");
    expect(csp).not.toContain("challenges.cloudflare.com");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("preview CSP is as strict as production", () => {
    const csp = headersFor({ deployEnv: "preview" }).get("Content-Security-Policy")!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self';");
  });

  it("local CSP does not upgrade insecure requests", () => {
    const csp = headersFor({ deployEnv: "local" }).get("Content-Security-Policy")!;
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("adds Turnstile origins only when enabled", () => {
    const csp = headersFor({ turnstileEnabled: true }).get("Content-Security-Policy")!;
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
  });

  it("emits HSTS only when enabled", () => {
    expect(headersFor({ enableHsts: true }).get("Strict-Transport-Security")).toBe(
      "max-age=31536000",
    );
    expect(headersFor({}).has("Strict-Transport-Security")).toBe(false);
  });

  it("enforces unsafe-inline scripts and sends no report-only policy (SRI spike, ADR-020)", () => {
    const headers = headersFor({});
    expect(headers.get("Content-Security-Policy")).toContain("script-src 'self' 'unsafe-inline'");
    expect(headers.has("Content-Security-Policy-Report-Only")).toBe(false);
  });

  it("allows unsafe-eval only under next dev", () => {
    expect(headersFor({}, true).get("Content-Security-Policy")).toContain("'unsafe-eval'");
    expect(headersFor({}).get("Content-Security-Policy")).not.toContain("unsafe-eval");
  });
});
