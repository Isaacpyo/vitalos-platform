import "server-only";
import type { Env } from "@vitalos/config";
import { createLogger } from "@vitalos/observability";
import { TURNSTILE_PROVIDER_ERRORS, verifyTurnstileToken } from "@vitalos/security/turnstile";
import {
  AdminService,
  CronService,
  DeepSeekProvider,
  FaqSyncService,
  HttpEmbedder,
  LogVisitorMailer,
  MemoryAdminNotifier,
  MemoryBroadcaster,
  MemoryRelayStore,
  MockProvider,
  NotionFaqReader,
  ResendVisitorMailer,
  SupabaseBroadcaster,
  adminTopic,
  SupabaseRelayStore,
  VisitorService,
  WebhookAdminNotifier,
  nullEmbedder,
} from "@vitalos/relay-core";
import type {
  HumanVerifier,
  Logger as RelayLogger,
  RelayContext,
  RelayStore,
} from "@vitalos/relay-core";
import { ingestEntries } from "@vitalos/relay-core/knowledge";
import {
  allBundledEntries,
  faqEntriesFromSnapshot,
  faqSnapshot,
  listPublicPaths,
} from "@vitalos/relay-knowledge";

export interface Relay {
  ctx: RelayContext;
  visitor: VisitorService;
  admin: AdminService;
  cron: CronService;
  faq: FaqSyncService;
  /** Seeds an in-memory store with the bundled knowledge (memory store only; idempotent). */
  ready: () => Promise<void>;
}

type Defer = (task: () => Promise<unknown>) => void;

function turnstileVerifier(env: Env): HumanVerifier {
  const secret = env.turnstile.secretKey;
  if (!secret) return { verify: () => Promise.resolve("disabled") };
  const expectedHostname = new URL(env.siteUrl).hostname;
  return {
    async verify(token, ip) {
      if (!token) return "failed";
      const result = await verifyTurnstileToken({
        secret,
        token,
        expectedAction: "relay",
        ...(ip ? { remoteIp: ip } : {}),
        // Previews run on generated hostnames; pin the hostname in production only.
        ...(env.deployEnv === "production" ? { expectedHostname } : {}),
      });
      if (result.success) return "passed";
      return result.errorCodes.some((c) => TURNSTILE_PROVIDER_ERRORS.includes(c))
        ? "unavailable"
        : "failed";
    },
  };
}

/** Builds Relay from the validated environment. Server-only: holds secrets. */
export function createRelay(env: Env, defer: Defer): Relay {
  const r = env.relay;
  const base = createLogger({ service: "relay", env: env.deployEnv });
  const logger: RelayLogger = {
    info: (m, f) => base.info(m, f),
    warn: (m, f) => base.warn(m, f),
    error: (m, f) => base.error(m, undefined, f),
  };

  const store: RelayStore =
    r.store === "supabase" && env.supabase.url && env.supabase.secretKey
      ? new SupabaseRelayStore({ url: env.supabase.url, secretKey: env.supabase.secretKey })
      : new MemoryRelayStore();
  const llm =
    r.provider === "deepseek" && r.deepseekApiKey
      ? new DeepSeekProvider({ apiKey: r.deepseekApiKey, baseURL: r.deepseekBaseUrl })
      : new MockProvider({ chunkDelayMs: 25 });
  const embedder =
    r.embedFunctionUrl && r.embedSecret
      ? new HttpEmbedder({ url: r.embedFunctionUrl, secret: r.embedSecret })
      : nullEmbedder;
  // Admins learn the topic from the signed inbox response; it changes when the secret rotates.
  const topic = adminTopic(r.adminApiSecrets[0] ?? r.tokenPepper ?? "relay-local");
  const broadcaster =
    r.realtimePublicKey && env.supabase.url && env.supabase.secretKey
      ? new SupabaseBroadcaster({
          url: env.supabase.url,
          secretKey: env.supabase.secretKey,
          adminTopic: topic,
        })
      : new MemoryBroadcaster();
  const notifier =
    r.superadminWebhookUrl && r.webhookSecret
      ? new WebhookAdminNotifier({ url: r.superadminWebhookUrl, secret: r.webhookSecret })
      : new MemoryAdminNotifier();
  // Real visitor email only through Resend, and outside production only to @vitalos.co.uk.
  const mailer =
    env.email.provider === "resend" && env.email.apiKey
      ? new ResendVisitorMailer({
          store,
          apiKey: env.email.apiKey,
          from: r.emailFrom,
          ...(env.deployEnv === "production"
            ? {}
            : { allowedRecipient: (to: string) => to.toLowerCase().endsWith("@vitalos.co.uk") }),
        })
      : new LogVisitorMailer(store);

  const ctx: RelayContext = {
    config: {
      deployEnv: env.deployEnv,
      aiEnabled: r.aiEnabled,
      model: r.model,
      summaryModel: r.summaryModel,
      simFloor: r.simFloor,
      rateLimitMultiplier: r.rateLimitMultiplier,
      dailyTokenCap: r.dailyTokenCap,
      tokenPepper: r.tokenPepper ?? "",
      ipSalt: r.ipSalt ?? "",
      allowedOrigins: r.allowedOrigins,
      privacyNoticeVersion: r.privacyNoticeVersion,
      privacyUrl: "/legal/privacy",
      realtime:
        r.realtimePublicKey && env.supabase.url
          ? {
              url: new URL(env.supabase.url).origin,
              publicKey: r.realtimePublicKey,
              adminTopic: topic,
            }
          : null,
      publicSiteUrl: env.siteUrl,
      adminBaseUrl: r.adminBaseUrl ?? null,
      turnstileRequired: Boolean(env.turnstile.secretKey && env.turnstile.siteKey),
      visitorEmailsEnabled: r.visitorEmailsEnabled,
      faq: { requireHubActive: r.faqRequireHubActive },
    },
    deps: {
      store,
      llm,
      embedder,
      broadcaster,
      notifier,
      human: turnstileVerifier(env),
      mailer,
      logger,
      now: () => new Date(),
      defer,
    },
  };

  let paths: Promise<Set<string>> | null = null;
  const publicPaths = () => (paths ??= listPublicPaths());

  const faq = new FaqSyncService(ctx, {
    reader:
      r.notion.token && r.faqSyncEnabled
        ? new NotionFaqReader({
            token: r.notion.token,
            dataSourceId: r.notion.dataSourceId,
            hubPageId: r.notion.hubPageId,
            ...(r.notion.apiVersion ? { notionVersion: r.notion.apiVersion } : {}),
          })
        : null,
    enabled: r.faqSyncEnabled,
    routeExists: async () => {
      const set = await publicPaths();
      return (path: string) => set.has(path);
    },
    snapshot: {
      hubStatus: faqSnapshot.hubStatus,
      needsConfirmation: faqSnapshot.needsConfirmation,
      held: faqSnapshot.held,
      entries: ({ requireHubActive }) => {
        // Route existence is resolved synchronously from the cached set when available.
        const set = cachedPaths;
        return faqEntriesFromSnapshot({
          routeExists: (p) => (set ? set.has(p) : true),
          requireHubActive,
        }).entries;
      },
    },
  });
  let cachedPaths: Set<string> | null = null;
  void publicPaths().then((s) => (cachedPaths = s));

  const admin = new AdminService(ctx, {
    bundledEntries: async ({ includeFaqSnapshot }) =>
      (await allBundledEntries({ requireHubActive: r.faqRequireHubActive, includeFaqSnapshot }))
        .entries,
    faq,
  });

  let seeded: Promise<void> | null = null;
  const ready = () =>
    (seeded ??=
      store instanceof MemoryRelayStore
        ? allBundledEntries({ requireHubActive: r.faqRequireHubActive }).then(
            async ({ entries }) => {
              await ingestEntries(store, nullEmbedder, entries);
            },
          )
        : Promise.resolve());

  return { ctx, visitor: new VisitorService(ctx), admin, cron: new CronService(ctx), faq, ready };
}
