import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// pnpm `auditConfig.ignoreGhsas` ignores GHSA-vfj7-8cjw-p6xm (braces) on every path. This guard fails
// if braces becomes reachable by a route other than the reviewed lint-time one, so a new
// (possibly runtime) dependency on it is not silently covered by the exception.
// See docs/security/dependency-advisories.md.
const REVIEWED_ROUTES = ["@next/eslint-plugin-next"];

type Node = { name: string; version?: string; dependents?: Node[] };

function chains(node: Node, trail: string[]): string[][] {
  const next = [...trail, node.name];
  const parents = node.dependents ?? [];
  return parents.length === 0 ? [next] : parents.flatMap((p) => chains(p, next));
}

describe("braces advisory exception", () => {
  it("is reachable only through reviewed build-time and lint-time routes", () => {
    const out = execFileSync("corepack", ["pnpm", "why", "braces", "--json"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const roots = JSON.parse(out) as Node[];
    const all = roots.flatMap((r) => chains(r, []));
    expect(all.length).toBeGreaterThan(0);
    const unreviewed = all.filter((c) => !c.some((n) => REVIEWED_ROUTES.includes(n)));
    expect(unreviewed.map((c) => c.join(" < "))).toEqual([]);
  });
});
