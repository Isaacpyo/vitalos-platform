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
    expect(directive(csp, "img-src")).toBe("'self' data:");
    expect(directive(csp, "font-src")).toBe("'self'");
    expect(directive(csp, "connect-src")).toBe("'self'");
    expect(directive(csp, "frame-src")).toBe("'none'");
    expect(csp).not.toContain("challenges.cloudflare.com");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("adds Relay realtime origins to connect-src and rejects anything that is not an origin", () => {
    const csp = buildCsp({ ...base, connect: ["wss://project.supabase.co"] });
    expect(directive(csp, "connect-src")).toBe("'self' wss://project.supabase.co");
    for (const bad of ["wss://a.co; script-src *", "wss://a.co/path", "*", "javascript:x"]) {
      expect(() => buildCsp({ ...base, connect: [bad] })).toThrow();
    }
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

  it("sets frame-ancestors to the given origins and rejects injection", () => {
    expect(
      directive(
        buildCsp({ ...base, frameAncestors: ["https://embedder.example.com"] }),
        "frame-ancestors",
      ),
    ).toBe("https://embedder.example.com");
    expect(directive(buildCsp({ ...base, frameAncestors: [] }), "frame-ancestors")).toBe("'none'");
    for (const bad of [
      "https://embedder.example.com; script-src *",
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
