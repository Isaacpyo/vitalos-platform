import { deriveFeatures, parseEnv } from "./schema";
import type { ContentSourceKind, DeployEnv, EnvSource } from "./schema";

/**
 * Build-safe entry for `next.config.ts`, scripts and tooling. It must never import
 * `server-only` and only exposes non-secret values.
 */
export interface BuildEnv {
  deployEnv: DeployEnv;
  siteUrl: string;
  contentSource: ContentSourceKind;
  indexable: boolean;
  enableHsts: boolean;
  turnstileEnabled: boolean;
  /** Public media origin for Insights and Careers images (CSP img-src, next/image), or undefined. */
  contentMediaOrigin: string | undefined;
  /** CV upload origin (CSP connect-src), or undefined. */
  careersUploadOrigin: string | undefined;
  /** The Super Admin's origin (not secret): the CV upload fallback when no upload host is set. */
  contentApiOrigin: string | undefined;
  /** Relay is on: the launcher renders and its API routes answer. */
  relayEnabled: boolean;
  /** Realtime WebSocket origin (ws/wss) for CSP connect-src, when Relay realtime is configured. */
  relayRealtimeOrigin: string | undefined;
  /** Search engine verification tokens for meta tags (public by design; docs/seo). */
  siteVerification: { google: string | undefined; bing: string | undefined };
}

export function readBuildEnv(source: EnvSource = process.env): BuildEnv {
  const env = parseEnv(source);
  const features = deriveFeatures(env);
  return {
    deployEnv: env.deployEnv,
    siteUrl: env.siteUrl,
    contentSource: env.contentSource,
    indexable: features.indexable,
    enableHsts: env.enableHsts,
    turnstileEnabled: features.turnstile,
    contentMediaOrigin: env.content.mediaOrigin,
    careersUploadOrigin: env.content.uploadOrigin,
    contentApiOrigin: env.content.apiBaseUrl,
    relayEnabled: features.relay,
    relayRealtimeOrigin:
      features.relay && env.relay.realtimePublicKey && env.supabase.url
        ? new URL(env.supabase.url).origin.replace(/^http/, "ws")
        : undefined,
    siteVerification: {
      google: env.search.googleSiteVerification,
      bing: env.search.bingSiteVerification,
    },
  };
}

export { deployEnvs, EnvValidationError } from "./schema";
export type { ContentSourceKind, DeployEnv } from "./schema";
