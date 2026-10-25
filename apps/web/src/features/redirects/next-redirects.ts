import type { NextConfig } from "next";
import { isLiveStaticRoute } from "../publication-gates/route-gates";
import { redirectMap } from "./redirect-map";
import { assertValidRedirects } from "./validate";

type RedirectRules = Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>;

/**
 * Static redirects for `next.config.ts`, derived from the version-controlled redirect map
 * (`redirect-map.ts`). The map is validated here, so a chain, a loop, a blanket redirect to "/"
 * or a redirect of a live route fails the build instead of reaching production. 410 rules are
 * not redirects; the proxy answers them (`gone.ts`). See ADR-018.
 */
/**
 * Whole sections that moved, with everything below them: the one place a path pattern is
 * allowed, because the redirect map is exact-path only. Each source's exact form must also be in
 * the redirect map (so it is validated there), and the destination keeps the rest of the path.
 */
export const sectionMoves: readonly { from: string; to: string }[] = [
  // Brief section 5.5: the blog is Insights.
  { from: "/blog", to: "/insights" },
  // Website Build Pack (25 Oct 2026): case studies live at /work, under the label "Case studies".
  { from: "/case-studies", to: "/work" },
];

export function nextRedirects(): RedirectRules {
  assertValidRedirects(redirectMap, { isLiveRoute: isLiveStaticRoute });
  return [
    ...redirectMap.flatMap((rule) =>
      rule.status === 410
        ? []
        : [{ source: rule.source, destination: rule.destination, statusCode: rule.status }],
    ),
    ...sectionMoves.map((move) => ({
      source: `${move.from}/:path+`,
      destination: `${move.to}/:path+`,
      statusCode: 308 as const,
    })),
  ];
}
