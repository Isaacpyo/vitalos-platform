import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe("buildCsp", () => {
  const base = { isDev: false, turnstile: false } as const;

  it("builds the locked-down production baseline", () => {
    const csp = buildCsp(base);
    expect(directive(csp, "default-src")).toBe("'self'");
    expect(directive(csp, "script-src")).toBe("'self' 'unsafe-inline'");
    expect(directive(csp, "object-src")).toBe("'none'");
    expect(directive(csp, "base-uri")).toBe("'self'");
    expect(directive(csp, "form-action")).toBe("'self'");
    expect(directive(csp, "frame-ancestors")).toBe("'none'");
    expect(directive(csp, "img-src")).toBe("'self' data: https://cdn.sanity.io");
    expect(directive(csp, "font-src")).toBe("'self'");
    expect(directive(csp, "connect-src")).toBe("'self'");
    expect(directive(csp, "frame-src")).toBe("'none'");
    expect(csp).not.toContain("challenges.cloudflare.com");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("allows unsafe-eval only in development", () => {
    expect(directive(buildCsp({ ...base, isDev: true }), "script-src")).toBe(
      "'self' 'unsafe-inline' 'unsafe-eval'",
    );
  });

  it("allows Turnstile script and frame only when enabled", () => {
    const csp = buildCsp({ ...base, turnstile: true });
    expect(directive(csp, "script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive(csp, "frame-src")).toBe("https://challenges.cloudflare.com");
  });

  it("adds Sanity API origins to connect-src only when asked and a project id is known", () => {
    const withApi = buildCsp({ ...base, sanityProjectId: "abc123", sanityApiConnect: true });
    expect(directive(withApi, "connect-src")).toBe(
      "'self' https://abc123.api.sanity.io https://abc123.apicdn.sanity.io wss://abc123.api.sanity.io",
    );
    expect(directive(buildCsp({ ...base, sanityProjectId: "abc123" }), "connect-src")).toBe(
      "'self'",
    );
    expect(directive(buildCsp({ ...base, sanityApiConnect: true }), "connect-src")).toBe("'self'");
  });

  it("rejects a malformed Sanity project id", () => {
    expect(() =>
      buildCsp({ ...base, sanityProjectId: "x; script-src *", sanityApiConnect: true }),
    ).toThrow();
  });

  it("sets frame-ancestors to the given origins and rejects injection", () => {
    expect(
      directive(
        buildCsp({ ...base, frameAncestors: ["https://studio.example.com"] }),
        "frame-ancestors",
      ),
    ).toBe("https://studio.example.com");
    expect(directive(buildCsp({ ...base, frameAncestors: [] }), "frame-ancestors")).toBe("'none'");
    for (const bad of [
      "https://studio.example.com; script-src *",
      "https://a.com https://b.com",
      "*",
      "https://a.com/path",
      "javascript:alert(1)",
    ]) {
      expect(() => buildCsp({ ...base, frameAncestors: [bad] })).toThrow();
    }
  });

  it("strict variant drops unsafe-inline scripts and keeps everything else", () => {
    const strict = buildCsp({ ...base, turnstile: true, variant: "strict" });
    expect(directive(strict, "script-src")).toBe("'self' https://challenges.cloudflare.com");
    expect(directive(strict, "script-src")).not.toContain("unsafe-inline");
    expect(directive(strict, "object-src")).toBe("'none'");
  });

  it("emits upgrade-insecure-requests only when requested", () => {
    expect(
      buildCsp({ ...base, upgradeInsecureRequests: true }).endsWith("; upgrade-insecure-requests"),
    ).toBe(true);
  });
});
