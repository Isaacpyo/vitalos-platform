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
  contentMediaOrigin: undefined,
  careersUploadOrigin: undefined,
  contentApiOrigin: undefined,
  relayEnabled: false,
  relayRealtimeOrigin: undefined,
  askbridge: undefined,
  siteVerification: { google: undefined, bing: undefined },
};

const headersFor = (env: Partial<BuildEnv>, isDev = false) => {
  const rules = getSecurityHeaders({ ...baseEnv, ...env }, { isDev });
  expect(rules[0]!.source).toBe("/:path*");
  expect(rules[0]!.has).toBeUndefined();
  expect(rules[0]!.missing).toBeUndefined();
  return new Map(rules[0]!.headers.map((header) => [header.key, header.value]));
};

describe("getSecurityHeaders", () => {
  it("lets only the /pay form post to the Super Admin and on to Stripe Checkout", () => {
    expect(headersFor({}).get("Content-Security-Policy")).toContain("form-action 'self';");
    const off = getSecurityHeaders(baseEnv, { isDev: false });
    expect(off.find((rule) => rule.source === "/pay")).toBeUndefined();
    const on = getSecurityHeaders(
      { ...baseEnv, contentApiOrigin: "https://admin.example.invalid" },
      { isDev: false },
    );
    expect(on[0]!.headers.find((h) => h.key === "Content-Security-Policy")?.value).toContain(
      "form-action 'self';",
    );
    const pay = on.find((rule) => rule.source === "/pay");
    expect(pay?.headers).toHaveLength(1);
    expect(pay?.headers[0]).toMatchObject({ key: "Content-Security-Policy" });
    expect(pay?.headers[0]?.value).toContain(
      "form-action 'self' https://admin.example.invalid https://checkout.stripe.com;",
    );
  });

  it("adds the Relay realtime origin to connect-src only when configured", () => {
    const off = headersFor({}).get("Content-Security-Policy") ?? "";
    expect(off).toContain("connect-src 'self';");
    const on =
      headersFor({ relayEnabled: true, relayRealtimeOrigin: "wss://project.supabase.co" }).get(
        "Content-Security-Policy",
      ) ?? "";
    expect(on).toContain("connect-src 'self' wss://project.supabase.co;");
  });

  it("allows the Askbridge origin and Turnstile only when the site key is set", () => {
    const off = headersFor({}).get("Content-Security-Policy") ?? "";
    expect(off).not.toContain("askbridge");
    expect(off).not.toContain("challenges.cloudflare.com");
    expect(off).toContain("frame-src 'none'");

    const on =
      headersFor({
        askbridge: { siteKey: "pk_" + "a".repeat(32), origin: "https://askbridge.example.invalid" },
      }).get("Content-Security-Policy") ?? "";
    const origin = "https://askbridge.example.invalid";
    const turnstile = "https://challenges.cloudflare.com";
    expect(on).toContain(`script-src 'self' 'unsafe-inline' ${origin} ${turnstile};`);
    expect(on).toContain(`connect-src 'self' ${origin};`);
    expect(on).toContain(`img-src 'self' data: ${origin};`);
    expect(on).toContain(`frame-src ${turnstile};`);
    expect(on).toContain("frame-ancestors 'none'");
    // The site's own Turnstile keys stay off: only the widget needs the Cloudflare origins.
    expect(on).not.toContain("wss:");
  });

  it.each(["local", "preview", "staging"] as const)("noindexes %s", (deployEnv) => {
    expect(headersFor({ deployEnv, indexable: false }).get("X-Robots-Tag")).toBe(
      "noindex, nofollow",
    );
  });

  it("does not noindex production on its canonical host", () => {
    expect(headersFor({}).has("X-Robots-Tag")).toBe(false);
  });

  it("noindexes production on every other host, such as a vercel.app alias", () => {
    const rules = getSecurityHeaders(baseEnv, { isDev: false });
    expect(rules).toHaveLength(2);
    expect(rules[1]).toEqual({
      source: "/:path*",
      missing: [{ type: "host", value: String.raw`www\.example\.invalid` }],
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    });
    const host = rules[1]!.missing![0]!.value!;
    expect(new RegExp(`^${host}$`).test("www.example.invalid")).toBe(true);
    expect(new RegExp(`^${host}$`).test("wwwxexample.invalid")).toBe(false);
  });

  it.each(["local", "preview", "staging"] as const)(
    "%s has one rule: everything is already noindex",
    (deployEnv) => {
      expect(getSecurityHeaders({ ...baseEnv, deployEnv, indexable: false })).toHaveLength(1);
    },
  );

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

  it("adds the content media host to img-src and the upload host to connect-src when set", () => {
    const csp = headersFor({
      contentMediaOrigin: "https://media.example.invalid",
      careersUploadOrigin: "https://uploads.example.invalid",
    }).get("Content-Security-Policy")!;
    expect(csp).toContain("img-src 'self' data: https://media.example.invalid;");
    expect(csp).toContain("connect-src 'self' https://uploads.example.invalid;");
    expect(headersFor({}).get("Content-Security-Policy")).toContain("img-src 'self' data:;");
    // Without an upload host the admin's own origin is the upload target (A9 fallback).
    expect(
      headersFor({ contentApiOrigin: "https://admin.example.invalid" }).get(
        "Content-Security-Policy",
      ),
    ).toContain("connect-src 'self' https://admin.example.invalid;");
  });
});
