import type { NextConfig } from "next";

type ImagesConfig = NonNullable<NextConfig["images"]>;
type RemotePattern = Exclude<NonNullable<ImagesConfig["remotePatterns"]>[number], URL>;

/**
 * `next/image` configuration (ADR-036, brief A8). Remote images are allowed only from the
 * content media host, and only when it is configured; otherwise the defaults stand (no remote
 * images at all).
 */
export function imagesConfig(mediaOrigin: string | undefined): ImagesConfig | undefined {
  if (!mediaOrigin) return undefined;
  const url = new URL(mediaOrigin);
  const pattern: RemotePattern = {
    protocol: url.protocol === "http:" ? "http" : "https",
    hostname: url.hostname,
    pathname: "/**",
    ...(url.port ? { port: url.port } : {}),
  };
  return { remotePatterns: [pattern] };
}
