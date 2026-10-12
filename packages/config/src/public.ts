import { z } from "zod";
import { publicEnvShape } from "./schema";

/**
 * Browser-safe configuration: only NEXT_PUBLIC_* variables. No `server-only`, no secrets.
 * Next inlines `process.env.NEXT_PUBLIC_*` only for literal property access, so each
 * variable is referenced explicitly in `publicProcessEnv`.
 */
const schema = z.object(publicEnvShape);

export interface PublicEnv {
  siteUrl: string;
  turnstileSiteKey: string | undefined;
}

export type PublicEnvSource = Readonly<Record<string, string | undefined>>;

export function publicProcessEnv(): PublicEnvSource {
  return {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  };
}

const blankToUndefined = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

export function readPublicEnv(source: PublicEnvSource = publicProcessEnv()): PublicEnv {
  const parsed = schema.parse({
    NEXT_PUBLIC_SITE_URL: blankToUndefined(source.NEXT_PUBLIC_SITE_URL),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: blankToUndefined(source.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  });
  // next.config.ts injects the resolved site URL (localhost only for the local deploy env), so
  // client and server always agree. Never invent a fallback here.
  if (parsed.NEXT_PUBLIC_SITE_URL === undefined) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set. It is injected by next.config.ts; pass it explicitly outside Next.js.",
    );
  }
  return {
    siteUrl: parsed.NEXT_PUBLIC_SITE_URL,
    turnstileSiteKey: parsed.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  };
}
