import type { NextConfig } from "next";
import type { BuildEnv } from "@vitalos/config/build";

type HeaderRules = Awaited<ReturnType<NonNullable<NextConfig["headers"]>>>;

/**
 * Security headers for `next.config.ts`. Stub owned by workstream E, which composes
 * `@vitalos/security/headers` and `/csp` here (including `X-Robots-Tag: noindex, nofollow`
 * for every non-production deploy env). See ADR-020.
 */
export function getSecurityHeaders(env: BuildEnv): HeaderRules {
  void env;
  return [];
}
