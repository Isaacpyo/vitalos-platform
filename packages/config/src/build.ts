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
  sanityProjectId: string | undefined;
  sanityStudioOrigin: string | undefined;
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
    sanityProjectId: env.sanity.projectId,
    sanityStudioOrigin: env.sanity.studioOrigin,
  };
}

export { deployEnvs, EnvValidationError } from "./schema";
export type { ContentSourceKind, DeployEnv } from "./schema";
