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

export const relayStores = ["supabase", "memory"] as const;
export const relayProviders = ["deepseek", "mock"] as const;

const booleanFlag = z.enum(["true", "false", "1", "0"]).optional();
const uuidLike = z
  .string()
  .regex(
    /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i,
    "must be a Notion id",
  );
const relayModel = z
  .string()
  .min(1)
  .max(80)
  .refine((m) => m !== "deepseek-chat" && m !== "deepseek-reasoner", {
    message: "deepseek-chat and deepseek-reasoner were retired on 24 July 2026; use deepseek-flash",
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
  // ---- Search (docs/seo). Public values by design: the key file and the meta tags are served. ----
  /** IndexNow key, served at /indexnow-key.txt and sent with each ping. Production only. */
  INDEXNOW_KEY: z
    .string()
    .regex(/^[A-Za-z0-9-]{8,128}$/, "must be 8-128 letters, digits or dashes")
    .optional(),
  /** Google Search Console HTML-tag verification token (the content of the meta tag). */
  GOOGLE_SITE_VERIFICATION: z
    .string()
    .regex(/^[A-Za-z0-9_-]{10,100}$/, "must be the token only, not the whole meta tag")
    .optional(),
  /** Bing Webmaster Tools verification token (msvalidate.01). */
  BING_SITE_VERIFICATION: z
    .string()
    .regex(/^[A-Za-z0-9]{10,64}$/, "must be the token only, not the whole meta tag")
    .optional(),
  // ---- Vitalos Relay (ADR-035 to ADR-038). Off unless RELAY_ENABLED=true. ----
  RELAY_ENABLED: booleanFlag,
  RELAY_STORE: z.enum(relayStores).optional(),
  RELAY_LLM_PROVIDER: z.enum(relayProviders).optional(),
  DEEPSEEK_API_KEY: z.string().min(20).optional(),
  DEEPSEEK_BASE_URL: z.url({ protocol: /^https$/ }).optional(),
  RELAY_MODEL: relayModel.optional(),
  RELAY_SUMMARY_MODEL: relayModel.optional(),
  RELAY_AI_ENABLED: booleanFlag,
  RELAY_DAILY_TOKEN_CAP: z.coerce.number().int().min(10_000).max(100_000_000).optional(),
  RELAY_SIM_FLOOR: z.coerce.number().min(0).max(0.99).optional(),
  /** Test runs only: multiplies the visitor rate limits (many browsers share one IP). */
  RELAY_RATE_LIMIT_MULTIPLIER: z.coerce.number().int().min(1).max(1000).optional(),
  RELAY_REALTIME_PUBLIC_KEY: z.string().min(20).optional(),
  RELAY_EMBED_FUNCTION_URL: z.url({ protocol: /^https?$/ }).optional(),
  RELAY_EMBED_SECRET: z.string().min(32).optional(),
  RELAY_TOKEN_PEPPER: z.string().min(32).optional(),
  RELAY_IP_SALT: z.string().min(16).optional(),
  RELAY_ALLOWED_ORIGINS: z.string().max(1000).optional(),
  RELAY_ADMIN_API_SECRET: z.string().min(32).optional(),
  RELAY_ADMIN_API_SECRET_PREVIOUS: z.string().min(32).optional(),
  RELAY_WEBHOOK_SECRET: z.string().min(32).optional(),
  RELAY_SUPERADMIN_WEBHOOK_URL: z.url({ protocol: /^https?$/ }).optional(),
  RELAY_ADMIN_BASE_URL: originUrl.optional(),
  RELAY_VISITOR_EMAILS_ENABLED: booleanFlag,
  RELAY_EMAIL_FROM: z.string().min(3).max(200).optional(),
  RELAY_PRIVACY_NOTICE_VERSION: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,40}$/, "must be 1-40 letters, numbers, dots, dashes or underscores")
    .optional(),
  NOTION_FAQ_TOKEN: z.string().min(20).optional(),
  NOTION_FAQ_DATA_SOURCE_ID: uuidLike.optional(),
  NOTION_FAQ_DATABASE_ID: uuidLike.optional(),
  NOTION_FAQ_HUB_PAGE_ID: uuidLike.optional(),
  NOTION_API_VERSION: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date such as 2025-09-03")
    .optional(),
  RELAY_FAQ_SYNC_ENABLED: booleanFlag,
  RELAY_FAQ_REQUIRE_HUB_ACTIVE: booleanFlag,
  RELAY_FAQ_WRITEBACK_ENABLED: booleanFlag,
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
  /** Search engine integration (docs/seo). */
  search: {
    indexNowKey: string | undefined;
    googleSiteVerification: string | undefined;
    bingSiteVerification: string | undefined;
  };
  relay: RelayEnv;
}

export interface RelayEnv {
  enabled: boolean;
  store: (typeof relayStores)[number];
  provider: (typeof relayProviders)[number];
  deepseekApiKey: string | undefined;
  deepseekBaseUrl: string;
  model: string;
  summaryModel: string;
  aiEnabled: boolean;
  dailyTokenCap: number;
  simFloor: number;
  rateLimitMultiplier: number;
  realtimePublicKey: string | undefined;
  embedFunctionUrl: string | undefined;
  embedSecret: string | undefined;
  tokenPepper: string | undefined;
  ipSalt: string | undefined;
  allowedOrigins: string[];
  adminApiSecrets: string[];
  webhookSecret: string | undefined;
  superadminWebhookUrl: string | undefined;
  adminBaseUrl: string | undefined;
  visitorEmailsEnabled: boolean;
  emailFrom: string;
  privacyNoticeVersion: string;
  notion: {
    token: string | undefined;
    dataSourceId: string;
    databaseId: string;
    hubPageId: string;
    apiVersion: string | undefined;
  };
  faqSyncEnabled: boolean;
  faqRequireHubActive: boolean;
  faqWritebackEnabled: boolean;
}

export interface Features {
  /** Both Turnstile keys are configured. */
  turnstile: boolean;
  /** An enquiry persistence backend (supabase or memory) is active. */
  enquiryPersistence: boolean;
  /** A notification provider and recipient are configured. */
  emailNotifications: boolean;
  /** Search engines may index this deployment (production only). */
  indexable: boolean;
  /** Vitalos Relay is switched on for this deployment. */
  relay: boolean;
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
      search: {
        indexNowKey: raw.INDEXNOW_KEY,
        googleSiteVerification: raw.GOOGLE_SITE_VERIFICATION,
        bingSiteVerification: raw.BING_SITE_VERIFICATION,
      },
      relay: resolveRelay(raw, deployEnv, siteUrl ?? LOCAL_SITE_URL, supabaseConfigured),
    },
  };
}

const flag = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value === "true" || value === "1";

function resolveRelay(
  raw: Raw,
  deployEnv: DeployEnv,
  siteUrl: string,
  supabaseConfigured: boolean,
): RelayEnv {
  const siteOrigins = [siteUrl];
  if (deployEnv === "production") {
    siteOrigins.push("https://vitalos.co.uk", "https://www.vitalos.co.uk");
  }
  const allowed = (raw.RELAY_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return {
    enabled: flag(raw.RELAY_ENABLED, false),
    store: raw.RELAY_STORE ?? (supabaseConfigured ? "supabase" : "memory"),
    provider: raw.RELAY_LLM_PROVIDER ?? (raw.DEEPSEEK_API_KEY ? "deepseek" : "mock"),
    deepseekApiKey: raw.DEEPSEEK_API_KEY,
    deepseekBaseUrl: raw.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    model: raw.RELAY_MODEL ?? "deepseek-flash",
    summaryModel: raw.RELAY_SUMMARY_MODEL ?? raw.RELAY_MODEL ?? "deepseek-flash",
    aiEnabled: flag(raw.RELAY_AI_ENABLED, true),
    dailyTokenCap: raw.RELAY_DAILY_TOKEN_CAP ?? 2_000_000,
    simFloor: raw.RELAY_SIM_FLOOR ?? 0.7,
    rateLimitMultiplier: raw.RELAY_RATE_LIMIT_MULTIPLIER ?? 1,
    realtimePublicKey: raw.RELAY_REALTIME_PUBLIC_KEY,
    embedFunctionUrl: raw.RELAY_EMBED_FUNCTION_URL,
    embedSecret: raw.RELAY_EMBED_SECRET,
    tokenPepper: raw.RELAY_TOKEN_PEPPER,
    ipSalt: raw.RELAY_IP_SALT,
    allowedOrigins: [...new Set([...siteOrigins, ...allowed])],
    adminApiSecrets: [raw.RELAY_ADMIN_API_SECRET, raw.RELAY_ADMIN_API_SECRET_PREVIOUS].filter(
      (v): v is string => Boolean(v),
    ),
    webhookSecret: raw.RELAY_WEBHOOK_SECRET,
    superadminWebhookUrl: raw.RELAY_SUPERADMIN_WEBHOOK_URL,
    adminBaseUrl: raw.RELAY_ADMIN_BASE_URL,
    visitorEmailsEnabled: flag(raw.RELAY_VISITOR_EMAILS_ENABLED, false),
    emailFrom: raw.RELAY_EMAIL_FROM ?? "Vitalos Relay <relay@notify.vitalos.co.uk>",
    privacyNoticeVersion:
      raw.RELAY_PRIVACY_NOTICE_VERSION ?? raw.ENQUIRY_PRIVACY_NOTICE_VERSION ?? "2026-10-relay",
    notion: {
      token: raw.NOTION_FAQ_TOKEN,
      dataSourceId: raw.NOTION_FAQ_DATA_SOURCE_ID ?? "3fae4b34-11f9-80b0-9910-000b57eabfa1",
      databaseId: raw.NOTION_FAQ_DATABASE_ID ?? "3fae4b34-11f9-808c-b450-c69d43e8f22c",
      hubPageId: raw.NOTION_FAQ_HUB_PAGE_ID ?? "3fae4b34-11f9-8053-9467-e390b032064a",
      apiVersion: raw.NOTION_API_VERSION,
    },
    faqSyncEnabled: flag(raw.RELAY_FAQ_SYNC_ENABLED, true),
    faqRequireHubActive: flag(raw.RELAY_FAQ_REQUIRE_HUB_ACTIVE, deployEnv === "production"),
    faqWritebackEnabled: flag(raw.RELAY_FAQ_WRITEBACK_ENABLED, false),
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
  if (env.turnstile.siteKey && !env.turnstile.secretKey) {
    add("TURNSTILE_SECRET_KEY", "is required when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set");
  }
  if (env.turnstile.secretKey && !env.turnstile.siteKey) {
    add("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "is required when TURNSTILE_SECRET_KEY is set");
  }
  issues.push(...relayIssues(env));
  return issues;
}

/** Relay rules: fail closed when Relay is on. Messages never include values. */
function relayIssues(env: Env): EnvIssue[] {
  const r = env.relay;
  const issues: EnvIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const production = env.deployEnv === "production";
  if (!r.enabled) return issues;
  if (production && r.store === "memory") add("RELAY_STORE", "memory is forbidden in production");
  if (production && r.rateLimitMultiplier !== 1) {
    add("RELAY_RATE_LIMIT_MULTIPLIER", "must be 1 (unset) in production");
  }
  if (production && r.provider === "mock") {
    add("RELAY_LLM_PROVIDER", "mock is forbidden in production");
  }
  if (!r.tokenPepper) add("RELAY_TOKEN_PEPPER", "is required when RELAY_ENABLED is true");
  if (!r.ipSalt) add("RELAY_IP_SALT", "is required when RELAY_ENABLED is true");
  if (r.store === "supabase" && (!env.supabase.url || !env.supabase.secretKey)) {
    add("SUPABASE_URL", "and SUPABASE_SECRET_KEY are required when RELAY_STORE is supabase");
  }
  if (r.provider === "deepseek" && !r.deepseekApiKey) {
    add("DEEPSEEK_API_KEY", "is required when RELAY_LLM_PROVIDER is deepseek");
  }
  if ((r.embedFunctionUrl === undefined) !== (r.embedSecret === undefined)) {
    add("RELAY_EMBED_SECRET", "and RELAY_EMBED_FUNCTION_URL must be set together");
  }
  if (r.superadminWebhookUrl && !r.webhookSecret) {
    add("RELAY_WEBHOOK_SECRET", "is required when RELAY_SUPERADMIN_WEBHOOK_URL is set");
  }
  if (production) {
    if (!env.turnstile.siteKey || !env.turnstile.secretKey) {
      add("TURNSTILE_SECRET_KEY", "Turnstile keys are required in production when Relay is on");
    }
    if (r.adminApiSecrets.length === 0) {
      add("RELAY_ADMIN_API_SECRET", "is required in production when Relay is on");
    }
    if (!r.superadminWebhookUrl) {
      add("RELAY_SUPERADMIN_WEBHOOK_URL", "is required in production when Relay is on");
    } else if (!r.superadminWebhookUrl.startsWith("https://")) {
      add("RELAY_SUPERADMIN_WEBHOOK_URL", "must be https in production");
    }
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
    relay: env.relay.enabled,
  };
}
