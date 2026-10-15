// Server-only entry: importing `@vitalos/config` from a client component fails the build.
// Use `@vitalos/config/public` in browser code and `@vitalos/config/build` in next.config.
export { features, getEnv, getFeatures, readServerEnv } from "./server";
export {
  DEFAULT_CONTENT_CACHE_TTL_SECONDS,
  contentSources,
  deployEnvs,
  deriveFeatures,
  emailProviders,
  enquiryBackends,
  EnvValidationError,
  fixtureSets,
  parseEnv,
  safeParseEnv,
} from "./schema";
export type {
  ContentEnv,
  ContentSourceKind,
  DeployEnv,
  EmailProvider,
  EnquiryBackend,
  Env,
  EnvIssue,
  EnvSource,
  Features,
  FixtureSet,
  ParseEnvResult,
  SigningKey,
} from "./schema";
