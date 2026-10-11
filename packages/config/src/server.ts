import "server-only";
import { deriveFeatures, parseEnv } from "./schema";
import type { Env, EnvSource, Features } from "./schema";

let cached: Env | undefined;

/** Validated server environment, parsed once per process. Throws `EnvValidationError`. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Uncached parse, for tests and tooling that supply their own source. */
export const readServerEnv = (source: EnvSource = process.env): Env => parseEnv(source);

export function getFeatures(): Features {
  return deriveFeatures(getEnv());
}

/** Feature flags derived from the validated server environment. */
export const features: Features = getFeatures();
