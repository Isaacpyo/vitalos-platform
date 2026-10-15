import { z } from "zod";

/**
 * Environment contract for the Vitalos platform (build-safe: no `server-only`).
 *
 * `parseEnv` validates the raw process environment, resolves defaults and then applies
 * cross-field rules. Error messages name variables, never their values.
 */

export const deployEnvs = ["local", "preview", "staging", "production"] as const;
export type DeployEnv = (typeof deployEnvs)[number];

/**
 * `repo` is the approved repo-file content served as the public site (ADR-028); it is the default
 * and may run in production. `fixtures` is artificial test content; `draft` is the full drafted set
 * including placeholders, pending owner approval (ADR-025). Neither may run in production.
 */
export const contentSources = ["repo", "empty", "fixtures", "draft"] as const;
export type ContentSourceKind = (typeof contentSources)[number];

export const fixtureSets = ["full", "sparse"] as const;
export type FixtureSet = (typeof fixtureSets)[number];

export const enquiryBackends = ["supabase", "memory", "disabled"] as const;
export type EnquiryBackend = (typeof enquiryBackends)[number];

export const emailProviders = ["none", "console", "postmark", "resend"] as const;
export type EmailProvider = (typeof emailProviders)[number];

const LOCAL_SITE_URL = "http://localhost:3000";

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

/** A bare host (`media.example.com`) or an origin; bare hosts are read as https. */
const hostOrOrigin = z.preprocess(
  (value) => (typeof value === "string" && !value.includes("://") ? `https://${value}` : value),
  originUrl,
);

/** Signing key ids (contract scheme v1): `[a-z0-9-]{1,32}`. */
const keyIdPattern = /^[a-z0-9-]{1,32}$/;
const MIN_SECRET_LENGTH = 32;

/** One signing key: the id sent in `X-Vitalos-Key-Id` and the shared secret. */
export interface SigningKey {
  id: string;
  secret: string;
}

/**
 * `keyId:secret[,keyId:secret]` (contract scheme v1, ADR-036). The first entry signs; a verifier
 * accepts any listed entry, so keys rotate with no downtime. Messages never echo the value.
 */
const keyList = z.string().transform((value, ctx): SigningKey[] => {
  const entries = value.split(",").map((entry) => entry.trim());
  const keys: SigningKey[] = [];
  for (const entry of entries) {
    const colon = entry.indexOf(":");
    const id = colon === -1 ? "" : entry.slice(0, colon);
    const secret = colon === -1 ? "" : entry.slice(colon + 1);
    if (!keyIdPattern.test(id) || secret.length < MIN_SECRET_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `must be keyId:secret entries separated by commas (key id [a-z0-9-]{1,32}, secret ${MIN_SECRET_LENGTH}+ characters)`,
      });
      return z.NEVER;
    }
    keys.push({ id, secret });
  }
  if (keys.length > 5 || new Set(keys.map((key) => key.id)).size !== keys.length) {
    ctx.addIssue({ code: "custom", message: "must list at most 5 keys with distinct key ids" });
    return z.NEVER;
  }
  return keys;
});

/** NEXT_PUBLIC_* variables: safe for browser bundles. Shared by `public.ts` and the full schema. */
export const publicEnvShape = {
  NEXT_PUBLIC_SITE_URL: originUrl.optional(),
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
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
  EMAIL_PROVIDER: z.enum(emailProviders).optional(),
  EMAIL_PROVIDER_API_KEY: z.string().min(1).optional(),
  /** Fallback alias for EMAIL_PROVIDER_API_KEY, used only when EMAIL_PROVIDER=resend. Server-only. */
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  ENQUIRY_NOTIFICATION_TO: z.email().optional(),
  ENQUIRY_IP_HASH_SALT: z.string().min(16).optional(),
  ENQUIRY_PRIVACY_NOTICE_VERSION: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,40}$/, "must be 1-40 letters, numbers, dots, dashes or underscores")
    .optional(),
  OUTBOX_DISPATCH_SECRET: z.string().min(32).optional(),
  // Sent by Vercel Cron as `Authorization: Bearer $CRON_SECRET`; accepted by the dispatch route.
  CRON_SECRET: z.string().min(32).optional(),
  ENABLE_HSTS: z.enum(["true", "false", "1", "0"]).optional(),
  // Insights and Careers content API on the Super Admin (ADR-035, ADR-036). Unset: not configured,
  // both sections behave as closed and nothing calls out.
  CONTENT_API_BASE_URL: originUrl.optional(),
  CONTENT_READ_KEY_ID: z.string().regex(keyIdPattern, "must match [a-z0-9-]{1,32}").optional(),
  CONTENT_READ_SECRET: z.string().min(MIN_SECRET_LENGTH).optional(),
  CAREERS_SUBMIT_KEY_ID: z.string().regex(keyIdPattern, "must match [a-z0-9-]{1,32}").optional(),
  CAREERS_SUBMIT_SECRET: z.string().min(MIN_SECRET_LENGTH).optional(),
  CONTENT_REVALIDATE_SECRET: keyList.optional(),
  CONTENT_RENDER_SECRET: keyList.optional(),
  CONTENT_PREVIEW_SECRET: keyList.optional(),
  CONTENT_CACHE_TTL_SECONDS: z.coerce.number().int().min(30).max(86_400).optional(),
  CONTENT_MEDIA_HOST: hostOrOrigin.optional(),
  CAREERS_UPLOAD_HOST: hostOrOrigin.optional(),
});

export const envKeys: readonly string[] = Object.keys(rawSchema.shape);

export interface Env {
  deployEnv: DeployEnv;
  siteUrl: string;
  contentSource: ContentSourceKind;
  fixtureSet: FixtureSet;
  supabase: { url: string | undefined; secretKey: string | undefined };
  turnstile: { siteKey: string | undefined; secretKey: string | undefined };
  enquiry: {
    backend: EnquiryBackend;
    notificationTo: string | undefined;
    ipHashSalt: string | undefined;
    /** Current privacy notice version. A submission must present this exact value. */
    privacyNoticeVersion: string | undefined;
    outboxDispatchSecret: string | undefined;
    /** `CRON_SECRET`: the bearer Vercel Cron presents to the dispatch route. */
    cronSecret: string | undefined;
  };
  email: {
    provider: EmailProvider;
    apiKey: string | undefined;
    from: string | undefined;
  };
  enableHsts: boolean;
  content: ContentEnv;
}

/** Insights and Careers content API settings (ADR-036). Server-only: holds secrets. */
export interface ContentEnv {
  /** Admin origin. Undefined means "not configured": both sections are closed. */
  apiBaseUrl: string | undefined;
  /** Signs read-API (and tick) calls to the admin. */
  readKey: SigningKey | undefined;
  /** Signs upload-ticket and application calls to the admin. */
  submitKey: SigningKey | undefined;
  /** Verify the admin's revalidate, render and preview calls (any listed key is accepted). */
  revalidateKeys: readonly SigningKey[];
  renderKeys: readonly SigningKey[];
  previewKeys: readonly SigningKey[];
  /** `revalidate` of every cached content read (default 600). */
  cacheTtlSeconds: number;
  /** Public media origin (next/image remotePatterns, CSP img-src, renderer image allowlist). */
  mediaOrigin: string | undefined;
  /** CV upload origin (CSP connect-src). */
  uploadOrigin: string | undefined;
}

export const DEFAULT_CONTENT_CACHE_TTL_SECONDS = 600;

export interface Features {
  /** Both Turnstile keys are configured. */
  turnstile: boolean;
  /** An enquiry persistence backend (supabase or memory) is active. */
  enquiryPersistence: boolean;
  /** A notification provider and recipient are configured. */
  emailNotifications: boolean;
  /** Search engines may index this deployment (production only). */
  indexable: boolean;
  /** The content API (Insights and Careers) is configured: base URL and read key. */
  content: boolean;
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
  const contentSource = raw.VITALOS_CONTENT_SOURCE ?? "repo";
  const supabaseConfigured = Boolean(raw.SUPABASE_URL && raw.SUPABASE_SECRET_KEY);
  const backend = raw.VITALOS_ENQUIRY_BACKEND ?? (supabaseConfigured ? "supabase" : "disabled");
  return {
    siteUrlMissing: siteUrl === undefined,
    env: {
      deployEnv,
      siteUrl: siteUrl ?? LOCAL_SITE_URL,
      contentSource,
      fixtureSet: raw.VITALOS_FIXTURE_SET ?? "full",
      supabase: { url: raw.SUPABASE_URL, secretKey: raw.SUPABASE_SECRET_KEY },
      turnstile: {
        siteKey: raw.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        secretKey: raw.TURNSTILE_SECRET_KEY,
      },
      enquiry: {
        backend,
        notificationTo: raw.ENQUIRY_NOTIFICATION_TO,
        ipHashSalt: raw.ENQUIRY_IP_HASH_SALT,
        privacyNoticeVersion: raw.ENQUIRY_PRIVACY_NOTICE_VERSION,
        outboxDispatchSecret: raw.OUTBOX_DISPATCH_SECRET,
        cronSecret: raw.CRON_SECRET,
      },
      email: {
        provider: raw.EMAIL_PROVIDER ?? "none",
        apiKey:
          raw.EMAIL_PROVIDER_API_KEY ??
          (raw.EMAIL_PROVIDER === "resend" ? raw.RESEND_API_KEY : undefined),
        from: raw.EMAIL_FROM,
      },
      enableHsts: raw.ENABLE_HSTS === "true" || raw.ENABLE_HSTS === "1",
      content: {
        apiBaseUrl: raw.CONTENT_API_BASE_URL,
        readKey:
          raw.CONTENT_READ_KEY_ID && raw.CONTENT_READ_SECRET
            ? { id: raw.CONTENT_READ_KEY_ID, secret: raw.CONTENT_READ_SECRET }
            : undefined,
        submitKey:
          raw.CAREERS_SUBMIT_KEY_ID && raw.CAREERS_SUBMIT_SECRET
            ? { id: raw.CAREERS_SUBMIT_KEY_ID, secret: raw.CAREERS_SUBMIT_SECRET }
            : undefined,
        revalidateKeys: raw.CONTENT_REVALIDATE_SECRET ?? [],
        renderKeys: raw.CONTENT_RENDER_SECRET ?? [],
        previewKeys: raw.CONTENT_PREVIEW_SECRET ?? [],
        cacheTtlSeconds: raw.CONTENT_CACHE_TTL_SECONDS ?? DEFAULT_CONTENT_CACHE_TTL_SECONDS,
        mediaOrigin: raw.CONTENT_MEDIA_HOST,
        uploadOrigin: raw.CAREERS_UPLOAD_HOST,
      },
    },
  };
}

/**
 * Cloudflare's documented Turnstile test keys (`1x000...AA`, `2x000...`, `3x000...`): always
 * pass, always fail or already-spent dummies. They are public, so a deployment using one would
 * accept any token. Real keys never start with `[123]x` followed by a run of zeros.
 */
const isCloudflareTestKey = (value: string): boolean => /^[123]x0{16,}/.test(value);

const BARE_ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** Exactly one mailbox: `address` or `Name <address>`; no commas, control characters or lists. */
function isSingleMailbox(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f,;]/.test(value)) return false;
  if (BARE_ADDRESS.test(value)) return true;
  const named = /^([^<>"@]+|"[^"<>@\\]+")\s*<([^<>\s]+)>$/.exec(value);
  return named !== null && BARE_ADDRESS.test(named[2] as string);
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
    raw.VITALOS_DEPLOY_ENV !== undefined &&
    raw.VITALOS_DEPLOY_ENV !== "production"
  ) {
    // Any non-production override (local, preview or staging) would switch off the production
    // guards (fixtures, draft, memory backend, noindex) on the production deployment.
    add(
      "VITALOS_DEPLOY_ENV",
      "must be production (or unset) when VERCEL_ENV is production (any other value would disable production guards)",
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
  if (production && env.contentSource === "fixtures") {
    add("VITALOS_CONTENT_SOURCE", "fixtures are forbidden in production");
  }
  if (production && env.contentSource === "draft") {
    add(
      "VITALOS_CONTENT_SOURCE",
      "draft content is forbidden in production (it is pending owner approval)",
    );
  }
  if (env.contentSource === "draft" && env.enquiry.backend === "supabase") {
    // The draft privacy skeleton is marked "not in force"; real enquiries must never be recorded
    // against it (ADR-025). The `repo` source carries the approved privacy notice (ADR-028).
    add(
      "VITALOS_ENQUIRY_BACKEND",
      "supabase cannot be combined with VITALOS_CONTENT_SOURCE=draft (the draft privacy notice is not in force)",
    );
  }
  if (production && env.enquiry.backend === "memory") {
    add("VITALOS_ENQUIRY_BACKEND", "memory is forbidden in production");
  }
  if (production && env.email.provider === "console") {
    add("EMAIL_PROVIDER", "console is forbidden in production (it would log enquiry content)");
  }
  if (production && env.email.provider === "none" && env.enquiry.notificationTo) {
    add(
      "EMAIL_PROVIDER",
      "must not be none in production once ENQUIRY_NOTIFICATION_TO is set (notifications would silently never send)",
    );
  }
  if (env.email.provider === "postmark" || env.email.provider === "resend") {
    for (const [path, value] of [
      ["EMAIL_FROM", env.email.from],
      ["EMAIL_PROVIDER_API_KEY", env.email.apiKey],
      ["ENQUIRY_NOTIFICATION_TO", env.enquiry.notificationTo],
    ] as const) {
      if (!value) add(path, `is required when EMAIL_PROVIDER is ${env.email.provider}`);
    }
    const from = env.email.from;
    if (from && !isSingleMailbox(from)) {
      add("EMAIL_FROM", "must be one address or `Name <address>` (no commas, tabs or line breaks)");
    }
  }
  if (env.enquiry.backend === "supabase") {
    if (!env.supabase.url) {
      add("SUPABASE_URL", "is required when VITALOS_ENQUIRY_BACKEND is supabase");
    }
    if (!env.supabase.secretKey) {
      add("SUPABASE_SECRET_KEY", "is required when VITALOS_ENQUIRY_BACKEND is supabase");
    }
  }
  if (production && env.enquiry.backend === "supabase") {
    // Fail closed: a live enquiry endpoint without human verification, IP hashing or a pinned
    // privacy notice version must not be deployable by omission.
    if (!env.turnstile.siteKey) {
      add(
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
        "is required in production when VITALOS_ENQUIRY_BACKEND is supabase",
      );
    }
    if (!env.turnstile.secretKey) {
      add(
        "TURNSTILE_SECRET_KEY",
        "is required in production when VITALOS_ENQUIRY_BACKEND is supabase",
      );
    }
    if (!env.enquiry.ipHashSalt) {
      add(
        "ENQUIRY_IP_HASH_SALT",
        "is required in production when VITALOS_ENQUIRY_BACKEND is supabase",
      );
    }
    if (!env.enquiry.privacyNoticeVersion) {
      add(
        "ENQUIRY_PRIVACY_NOTICE_VERSION",
        "is required in production when VITALOS_ENQUIRY_BACKEND is supabase",
      );
    }
  }
  if (production && env.turnstile.secretKey && isCloudflareTestKey(env.turnstile.secretKey)) {
    add("TURNSTILE_SECRET_KEY", "is a Cloudflare test secret, which accepts every token");
  }
  if (production && env.turnstile.siteKey && isCloudflareTestKey(env.turnstile.siteKey)) {
    add("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "is a Cloudflare test site key");
  }
  for (const [idName, secretName] of [
    ["CONTENT_READ_KEY_ID", "CONTENT_READ_SECRET"],
    ["CAREERS_SUBMIT_KEY_ID", "CAREERS_SUBMIT_SECRET"],
  ] as const) {
    if (raw[idName] && !raw[secretName]) add(secretName, `is required when ${idName} is set`);
    if (raw[secretName] && !raw[idName]) add(idName, `is required when ${secretName} is set`);
  }
  if (env.content.apiBaseUrl) {
    if (!raw.CONTENT_READ_KEY_ID && !raw.CONTENT_READ_SECRET) {
      add("CONTENT_READ_SECRET", "is required when CONTENT_API_BASE_URL is set");
      add("CONTENT_READ_KEY_ID", "is required when CONTENT_API_BASE_URL is set");
    }
    if (production && !env.content.apiBaseUrl.startsWith("https://")) {
      add("CONTENT_API_BASE_URL", "must be an https origin in production");
    }
  }
  for (const [name, value] of [
    ["CONTENT_MEDIA_HOST", env.content.mediaOrigin],
    ["CAREERS_UPLOAD_HOST", env.content.uploadOrigin],
  ] as const) {
    if (production && value && !value.startsWith("https://")) {
      add(name, "must be https in production");
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
    turnstile: Boolean(env.turnstile.siteKey && env.turnstile.secretKey),
    enquiryPersistence: env.enquiry.backend !== "disabled",
    emailNotifications: env.email.provider !== "none" && Boolean(env.enquiry.notificationTo),
    indexable: env.deployEnv === "production",
    content: Boolean(env.content.apiBaseUrl && env.content.readKey),
  };
}
