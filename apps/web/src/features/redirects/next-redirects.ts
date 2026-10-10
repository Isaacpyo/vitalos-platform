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
export function nextRedirects(): RedirectRules {
  assertValidRedirects(redirectMap, { isLiveRoute: isLiveStaticRoute });
  return redirectMap.flatMap((rule) =>
    rule.status === 410
      ? []
      : [{ source: rule.source, destination: rule.destination, statusCode: rule.status }],
  );
}
