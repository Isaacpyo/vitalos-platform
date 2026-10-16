import { describe, expect, it } from "vitest";
import { goneResponse, goneSet, isGone } from "./gone";
import { nextRedirects } from "./next-redirects";
import { redirectMap, seedRedirects } from "./redirect-map";
import type { RedirectRule } from "./types";
import { assertValidRedirects, validateRedirects } from "./validate";
import { isLiveStaticRoute } from "../publication-gates/route-gates";
const live = { isLiveRoute: isLiveStaticRoute };
const issues = (rules: RedirectRule[]) => validateRedirects(rules, live).map((i) => i.message);

describe("seed redirect map", () => {
  it("holds exactly the four redirects named in the specification", () => {
    expect(seedRedirects).toEqual([
      { source: "/services", destination: "/what-we-do", status: 308 },
      { source: "/technologies", destination: "/labs", status: 308 },
      { source: "/privacy", destination: "/legal/privacy", status: 308 },
      { source: "/terms", destination: "/legal/terms", status: 308 },
    ]);
  });

  it("is valid: no chains, loops, blanket redirects or live-route shadowing", () => {
    expect(validateRedirects(redirectMap, live)).toEqual([]);
    expect(() => assertValidRedirects(redirectMap, live)).not.toThrow();
  });

  it("never sends anything to the home page", () => {
    expect(redirectMap.every((rule) => rule.destination !== "/")).toBe(true);
  });

  it("is what next.config receives: redirects only, with their status codes", () => {
    expect(nextRedirects()).toEqual([
      { source: "/services", destination: "/what-we-do", statusCode: 308 },
      { source: "/technologies", destination: "/labs", statusCode: 308 },
      { source: "/privacy", destination: "/legal/privacy", statusCode: 308 },
      { source: "/terms", destination: "/legal/terms", statusCode: 308 },
      { source: "/about/leadership", destination: "/about", statusCode: 308 },
    ]);
  });
});

describe("validateRedirects", () => {
  const r = (source: string, destination: string, status: 301 | 308 = 301): RedirectRule => ({
    source,
    destination,
    status,
  });

  it("rejects chains", () => {
    expect(issues([r("/a", "/b"), r("/b", "/c")])[0]).toMatch(/chain/);
  });

  it("rejects loops and self-redirects", () => {
    const loop = issues([r("/a", "/b"), r("/b", "/a")]);
    expect(loop.some((m) => /chain/.test(m))).toBe(true);
    expect(loop.some((m) => /loop/.test(m))).toBe(true);
    expect(issues([r("/a", "/a")])).toContain("redirects to itself");
    expect(issues([r("/a", "/b"), r("/b", "/c"), r("/c", "/a")]).some((m) => /loop/.test(m))).toBe(
      true,
    );
  });

  it("rejects blanket redirects to the home page", () => {
    expect(issues([r("/old", "/")])).toContain("blanket redirect to / is not allowed");
    expect(issues([r("/old", "/?ref=x")])).toContain("blanket redirect to / is not allowed");
  });

  it("rejects wildcard and pattern sources (no blanket or regex rules)", () => {
    for (const source of ["/:path*", "/blog/*", "/(.*)", "/a/:slug", "/a+", "/a?b=1"]) {
      expect(issues([r(source, "/b")]).join()).toMatch(/exact path/);
    }
  });

  it("rejects redirecting the home page, live routes and malformed sources", () => {
    expect(issues([r("/", "/a")])).toContain("the home page cannot be redirected");
    expect(issues([r("/what-we-do", "/a")]).join()).toMatch(/live route/);
    expect(issues([r("/api/health", "/a")]).join()).toMatch(/live route/);
    expect(issues([r("/api", "/a")]).join()).toMatch(/live route/);
    // Slug changes redirect a dynamic detail path: allowed.
    expect(issues([r("/insights/old-slug", "/insights/new-slug")])).toEqual([]);
    expect(issues([r("/work/old", "/work/new", 308)])).toEqual([]);
    expect(issues([r("//evil.invalid", "/a")]).join()).toMatch(/single \//);
    expect(issues([r("old", "/a")]).join()).toMatch(/single \//);
    expect(issues([r("/old/", "/a")]).join()).toMatch(/slash/);
    expect(issues([r("/o ld", "/a")]).join()).toMatch(/whitespace/);
  });

  it("rejects insecure, protocol-relative, credentialed and wildcard destinations", () => {
    for (const destination of [
      "http://example.invalid/",
      "//evil.invalid",
      "/\\evil",
      "/a*",
      "https://user:pass@example.invalid/",
      "https://exa mple.invalid/",
      "javascript:alert(1)",
    ]) {
      expect(issues([r("/old", destination)]).length).toBeGreaterThan(0);
    }
    expect(issues([r("/old", "/contact?intent=procurement")])).toEqual([]);
  });

  it("allows https external destinations (as the redirect rules allow)", () => {
    expect(issues([r("/old", "https://example.invalid/new")])).toEqual([]);
    // An external destination is never a chain, even if its path matches another source.
    expect(issues([r("/a", "https://example.invalid/b"), r("/b", "/c")])).toEqual([]);
  });

  it("rejects duplicate sources", () => {
    expect(issues([r("/a", "/b"), r("/a", "/c")])).toContain("duplicate source");
  });

  it("handles 410 rules: no destination, and nothing may redirect to a gone path", () => {
    expect(issues([{ source: "/retired", status: 410 }])).toEqual([]);
    expect(
      issues([{ source: "/retired", destination: "/x", status: 410 } as unknown as RedirectRule]),
    ).toContain("a 410 rule must not have a destination");
    expect(issues([r("/a", "/retired"), { source: "/retired", status: 410 }]).join()).toMatch(
      /gone/,
    );
    expect(issues([{ source: "/a", status: 301 } as unknown as RedirectRule]).join()).toMatch(
      /needs a destination/,
    );
  });

  it("accepts 308", () => {
    expect(issues([r("/old", "/new", 308)])).toEqual([]);
  });

  it("makes nextRedirects-style assertion throw with every problem named", () => {
    expect(() => assertValidRedirects([r("/a", "/b"), r("/b", "/")], live)).toThrow(
      /chain[\s\S]*blanket/,
    );
  });
});

describe("gone (410)", () => {
  const rules: RedirectRule[] = [
    { source: "/retired", status: 410 },
    { source: "/old", destination: "/new", status: 301 },
  ];

  it("matches only 410 rules, ignoring a trailing slash", () => {
    const set = goneSet(rules);
    expect(isGone("/retired", set)).toBe(true);
    expect(isGone("/retired/", set)).toBe(true);
    expect(isGone("/old", set)).toBe(false);
    expect(isGone("/retired/child", set)).toBe(false);
    expect(isGone("/", set)).toBe(false);
  });

  it("has no gone paths in the seed", () => {
    expect(isGone("/services")).toBe(false);
    expect(goneSet().size).toBe(0);
  });

  it("answers 410 with a plain, short-lived response", () => {
    const response = goneResponse();
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toContain("max-age=0");
  });
});
