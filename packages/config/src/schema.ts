import { z } from "zod";

/**
 * Environment contract for the Vitalos platform (build-safe: no `server-only`).
 *
 * `parseEnv` validates the raw process environment, resolves defaults and then applies
 * cross-field rules. Error messages name variables, never their values.
 */

export const deployEnvs = ["local", "preview", "staging", "production"] as const;
export type DeployEnv = (typeof deployEnvs)[number];

export const contentSources = ["sanity", "empty", "fixtures"] as const;
export type ContentSourceKind = (typeof contentSources)[number];

export const fixtureSets = ["full", "sparse"] as const;
export type FixtureSet = (typeof fixtureSets)[number];

export const enquiryBackends = ["supabase", "memory", "disabled"] as const;
export type EnquiryBackend = (typeof enquiryBackends)[number];

export const emailProviders = ["none", "console"] as const;
export type EmailProvider = (typeof emailProviders)[number];

const LOCAL_SITE_URL = "http://localhost:3000";
const DEFAULT_SANITY_DATASET = "development";
const DEFAULT_SANITY_API_VERSION = "2025-02-19";

/** http(s) URL with no path, query or fragment; normalised to its origin (no trailing slash). */
export const originUrl = z
  .url({ protocol: /^https?$/ })
  .refine(
    (value) => {
      if (/[?#]/.test(value)) return false;
      // The url() check reports unparseable values; do not throw here.
      if (!URL.canParse(value)) return true;
      const { pathname } = new URL(value);
      return pathname === "/";
    },
    { message: "must be an origin (scheme and host) with no path, query or fragment" },
  )
  .transform((value) => (URL.canParse(value) ? new URL(value).origin : value));

/** NEXT_PUBLIC_* variables: safe for browser bundles. Shared by `public.ts` and the full schema. */
export const publicEnvShape = {
  NEXT_PUBLIC_SITE_URL: originUrl.optional(),
  NEXT_PUBLIC_SANITY_PROJECT_ID: z
    .string()
    .regex(/^[a-z0-9-]+$/, "must be lowercase letters, numbers and dashes")
    .optional(),
  NEXT_PUBLIC_SANITY_DATASET: z
    .string()
    .regex(/^[a-z0-9_-]+$/, "must be lowercase letters, numbers, dashes and underscores")
    .optional(),
  NEXT_PUBLIC_SANITY_API_VERSION: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD form")
    .optional(),
  NEXT_PUBLIC_SANITY_STUDIO_URL: z.url({ protocol: /^https?$/ }).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(10).optional(),
} as const;

const rawSchema = z.object({
  ...publicEnvShape,
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: z.string().min(1).optional(),
  VITALOS_DEPLOY_ENV: z.enum(deployEnvs).optional(),
  VITALOS_CONTENT_SOURCE: z.enum(contentSources).optional(),
  VITALOS_FIXTURE_SET: z.enum(fixtureSets).optional(),
  VITALOS_ENQUIRY_BACKEND: z.enum(enquiryBackends).optional(),
  SANITY_API_READ_TOKEN: z.string().min(10).optional(),
  SANITY_REVALIDATE_SECRET: z.string().min(16).optional(),
  SANITY_STUDIO_ORIGIN: originUrl.optional(),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
  EMAIL_PROVIDER: z.enum(emailProviders).optional(),
  EMAIL_PROVIDER_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  ENQUIRY_NOTIFICATION_TO: z.email().optional(),
  ENQUIRY_IP_HASH_SALT: z.string().min(16).optional(),
  OUTBOX_DISPATCH_SECRET: z.string().min(32).optional(),
  ENABLE_HSTS: z.enum(["true", "false", "1", "0"]).optional(),
});

export const envKeys: readonly string[] = Object.keys(rawSchema.shape);

export interface Env {
  deployEnv: DeployEnv;
  siteUrl: string;
  contentSource: ContentSourceKind;
  fixtureSet: FixtureSet;
  sanity: {
    projectId: string | undefined;
    dataset: string;
    apiVersion: string;
    studioUrl: string | undefined;
    studioOrigin: string | undefined;
    readToken: string | undefined;
    revalidateSecret: string | undefined;
  };
  supabase: { url: string | undefined; secretKey: string | undefined };
  turnstile: { siteKey: string | undefined; secretKey: string | undefined };
  enquiry: {
    backend: EnquiryBackend;
    notificationTo: string | undefined;
    ipHashSalt: string | undefined;
    outboxDispatchSecret: string | undefined;
  };
  email: {
    provider: EmailProvider;
    apiKey: string | undefined;
    from: string | undefined;
  };
  enableHsts: boolean;
}

export interface Features {
  /** Content is read from Sanity. */
  cms: boolean;
  /** Both Turnstile keys are configured. */
  turnstile: boolean;
  /** An enquiry persistence backend (supabase or memory) is active. */
  enquiryPersistence: boolean;
  /** A notification provider and recipient are configured. */
  emailNotifications: boolean;
  /** Search engines may index this deployment (production only). */
  indexable: boolean;
}

export interface EnvIssue {
  path: string;
  message: string;
}

export class EnvValidationError extends Error {
  readonly issues: readonly EnvIssue[];
  constructor(issues: readonly EnvIssue[]) {
    super(
      `Invalid environment configuration:\n${issues.map((i) => `- ${i.path}: ${i.message}`).join("\n")}`,
    );
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Empty or whitespace-only values (`FOO=` in .env files) are treated as unset. */
function normalise(source: EnvSource): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    const value = source[key]?.trim();
    out[key] = value === undefined || value === "" ? undefined : value;
  }
  return out;
}

type Raw = z.infer<typeof rawSchema>;

/**
 * NODE_ENV is deliberately NOT used to detect production. `next build` and `next start` set
 * NODE_ENV=production on every machine (local runs, CI, e2e), so it cannot tell a production
 * deployment from a local production build. The deploy env comes only from VITALOS_DEPLOY_ENV
 * or VERCEL_ENV and defaults to `local`, which is fail-closed for search engines: only
 * `production` is indexable (`features.indexable`) and production-only guards below apply.
 */
function deriveDeployEnv(raw: Raw): DeployEnv {
  if (raw.VITALOS_DEPLOY_ENV) return raw.VITALOS_DEPLOY_ENV;
  if (raw.VERCEL_ENV === "production") return "production";
  if (raw.VERCEL_ENV === "preview") return "preview";
  return "local";
}

function deriveSiteUrl(raw: Raw, deployEnv: DeployEnv): string | undefined {
  if (raw.NEXT_PUBLIC_SITE_URL) return raw.NEXT_PUBLIC_SITE_URL;
  if (deployEnv === "local") return LOCAL_SITE_URL;
  if (deployEnv !== "production" && raw.VERCEL_URL) return `https://${raw.VERCEL_URL}`;
  return undefined;
}

function resolve(raw: Raw): { env: Env; siteUrlMissing: boolean } {
  const deployEnv = deriveDeployEnv(raw);
  const siteUrl = deriveSiteUrl(raw, deployEnv);
  const projectId = raw.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const contentSource = raw.VITALOS_CONTENT_SOURCE ?? (projectId ? "sanity" : "empty");
  const supabaseConfigured = Boolean(raw.SUPABASE_URL && raw.SUPABASE_SECRET_KEY);
  const backend = raw.VITALOS_ENQUIRY_BACKEND ?? (supabaseConfigured ? "supabase" : "disabled");
  return {
    siteUrlMissing: siteUrl === undefined,
    env: {
      deployEnv,
      siteUrl: siteUrl ?? LOCAL_SITE_URL,
      contentSource,
      fixtureSet: raw.VITALOS_FIXTURE_SET ?? "full",
      sanity: {
        projectId,
        dataset: raw.NEXT_PUBLIC_SANITY_DATASET ?? DEFAULT_SANITY_DATASET,
        apiVersion: raw.NEXT_PUBLIC_SANITY_API_VERSION ?? DEFAULT_SANITY_API_VERSION,
        studioUrl: raw.NEXT_PUBLIC_SANITY_STUDIO_URL,
        studioOrigin: raw.SANITY_STUDIO_ORIGIN,
        readToken: raw.SANITY_API_READ_TOKEN,
        revalidateSecret: raw.SANITY_REVALIDATE_SECRET,
      },
      supabase: { url: raw.SUPABASE_URL, secretKey: raw.SUPABASE_SECRET_KEY },
      turnstile: {
        siteKey: raw.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        secretKey: raw.TURNSTILE_SECRET_KEY,
      },
      enquiry: {
        backend,
        notificationTo: raw.ENQUIRY_NOTIFICATION_TO,
        ipHashSalt: raw.ENQUIRY_IP_HASH_SALT,
        outboxDispatchSecret: raw.OUTBOX_DISPATCH_SECRET,
      },
      email: {
        provider: raw.EMAIL_PROVIDER ?? "none",
        apiKey: raw.EMAIL_PROVIDER_API_KEY,
        from: raw.EMAIL_FROM,
      },
      enableHsts: raw.ENABLE_HSTS === "true" || raw.ENABLE_HSTS === "1",
    },
  };
}

/** Cross-field rules. Messages never include variable values. */
function crossFieldIssues(env: Env, raw: Raw, siteUrlMissing: boolean): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const production = env.deployEnv === "production";

  if (siteUrlMissing) {
    add("NEXT_PUBLIC_SITE_URL", `is required when VITALOS_DEPLOY_ENV is ${env.deployEnv}`);
  } else if (production && !env.siteUrl.startsWith("https://")) {
    add("NEXT_PUBLIC_SITE_URL", "must be an https URL in production");
  }
  if (
    raw.VERCEL_ENV === "production" &&
    (raw.VITALOS_DEPLOY_ENV === "local" || raw.VITALOS_DEPLOY_ENV === "preview")
  ) {
    add(
      "VITALOS_DEPLOY_ENV",
      "cannot be local or preview when VERCEL_ENV is production (it would disable production guards)",
    );
  }
  if (production && raw.VITALOS_CONTENT_SOURCE === undefined) {
    add(
      "VITALOS_CONTENT_SOURCE",
      "must be set explicitly in production so that an empty content source is deliberate",
    );
  }
  if (production && raw.VITALOS_ENQUIRY_BACKEND === undefined) {
    add(
      "VITALOS_ENQUIRY_BACKEND",
      "must be set explicitly in production so that disabled enquiries are deliberate",
    );
  }
  if (
    production &&
    env.contentSource === "sanity" &&
    raw.NEXT_PUBLIC_SANITY_DATASET === undefined
  ) {
    add(
      "NEXT_PUBLIC_SANITY_DATASET",
      "must be set explicitly in production (the default development dataset is never used)",
    );
  }
  if (production && env.contentSource === "fixtures") {
    add("VITALOS_CONTENT_SOURCE", "fixtures are forbidden in production");
  }
  if (production && env.enquiry.backend === "memory") {
    add("VITALOS_ENQUIRY_BACKEND", "memory is forbidden in production");
  }
  if (production && env.email.provider === "console") {
    add("EMAIL_PROVIDER", "console is forbidden in production (it would log enquiry content)");
  }
  if (env.contentSource === "sanity" && !env.sanity.projectId) {
    add("NEXT_PUBLIC_SANITY_PROJECT_ID", "is required when VITALOS_CONTENT_SOURCE is sanity");
  }
  if (env.enquiry.backend === "supabase") {
    if (!env.supabase.url) {
      add("SUPABASE_URL", "is required when VITALOS_ENQUIRY_BACKEND is supabase");
    }
    if (!env.supabase.secretKey) {
      add("SUPABASE_SECRET_KEY", "is required when VITALOS_ENQUIRY_BACKEND is supabase");
    }
  }
  if (env.turnstile.siteKey && !env.turnstile.secretKey) {
    add("TURNSTILE_SECRET_KEY", "is required when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set");
  }
  if (env.turnstile.secretKey && !env.turnstile.siteKey) {
    add("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "is required when TURNSTILE_SECRET_KEY is set");
  }
  return issues;
}

export type ParseEnvResult =
  { success: true; data: Env } | { success: false; issues: readonly EnvIssue[] };

export function safeParseEnv(source: EnvSource): ParseEnvResult {
  const parsed = rawSchema.safeParse(normalise(source));
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }
  const { env, siteUrlMissing } = resolve(parsed.data);
  const issues = crossFieldIssues(env, parsed.data, siteUrlMissing);
  return issues.length > 0 ? { success: false, issues } : { success: true, data: env };
}

export function parseEnv(source: EnvSource): Env {
  const result = safeParseEnv(source);
  if (!result.success) throw new EnvValidationError(result.issues);
  return result.data;
}

export function deriveFeatures(env: Env): Features {
  return {
    cms: env.contentSource === "sanity",
    turnstile: Boolean(env.turnstile.siteKey && env.turnstile.secretKey),
    enquiryPersistence: env.enquiry.backend !== "disabled",
    emailNotifications: env.email.provider !== "none" && Boolean(env.enquiry.notificationTo),
    indexable: env.deployEnv === "production",
  };
}
