import type { Env } from "@vitalos/config";
import { MemoryOutboxStore } from "./adapters/memory-outbox";
import { MemoryEnquiryRepository } from "./adapters/memory-repository";
import { MemoryRateLimiter } from "./adapters/memory-rate-limiter";
import { ConsoleNotifier } from "./adapters/console-notifier";
import { PostmarkNotifier, ResendNotifier } from "./adapters/email-notifier";
import { createEnquiryLogger } from "./adapters/observability-logger";
import { PostgresRateLimiter } from "./adapters/postgres-rate-limiter";
import { SupabaseEnquiryRepository } from "./adapters/supabase-repository";
import { SupabaseOutboxStore } from "./adapters/supabase-outbox";
import { createSupabaseRpcClient } from "./adapters/supabase-rpc";
import type { RpcClient } from "./adapters/supabase-rpc";
import { DisabledVerifier, TurnstileVerifier } from "./adapters/turnstile-verifier";
import { dispatchOutbox } from "./application/dispatch-outbox";
import type { DispatchSummary } from "./application/dispatch-outbox";
import { receiveEnquiry } from "./application/receive-enquiry";
import type { ReceiveRequest, ReceiveResult } from "./application/receive-enquiry";
import type {
  EnquiryLogger,
  EnquiryRepository,
  HumanVerifier,
  Notifier,
  OutboxStore,
  RateLimiter,
} from "./domain/ports";

/**
 * Composition root: the only place that knows which adapter backs which port. Application code
 * receives ports, never providers.
 *
 * With no persistence configured the service is honestly `unavailable`: `receive` answers
 * `{ kind: "unavailable" }` (HTTP 503) and nothing is stored or pretended.
 */
export interface EnquiryService {
  /** False when no backend is configured or its required secrets are missing. */
  readonly available: boolean;
  receive(request: ReceiveRequest): Promise<ReceiveResult>;
  /**
   * Drains one outbox batch. `null` when there is no backend or no notifier configured: items
   * then simply stay pending (the outbox is the durability guarantee).
   */
  dispatch(): Promise<DispatchSummary | null>;
}

export interface EnquiryServiceOverrides {
  /** Replaces the Supabase client (tests). */
  rpcClient?: RpcClient;
  logger?: EnquiryLogger;
  notifier?: Notifier;
  fetch?: typeof fetch;
}

interface MemoryBackend {
  repository: MemoryEnquiryRepository;
  outbox: MemoryOutboxStore;
  limiter: MemoryRateLimiter;
  salt: string;
}

// Route handlers and server actions can be bundled separately; one shared instance per process
// keeps the memory backend coherent between them.
const memoryKey = Symbol.for("vitalos.enquiries.memory-backend");
type GlobalWithMemory = typeof globalThis & { [memoryKey]?: MemoryBackend };

function memoryBackend(): MemoryBackend {
  const holder = globalThis as GlobalWithMemory;
  holder[memoryKey] ??= (() => {
    const repository = new MemoryEnquiryRepository();
    return {
      repository,
      outbox: new MemoryOutboxStore(repository),
      limiter: new MemoryRateLimiter(),
      salt: crypto.randomUUID() + crypto.randomUUID(),
    };
  })();
  return holder[memoryKey];
}

/** Test hook: the in-process backend used when VITALOS_ENQUIRY_BACKEND=memory. */
export const getMemoryBackendForTests = (): MemoryBackend => memoryBackend();

const unavailable: EnquiryService = {
  available: false,
  receive: () => Promise.resolve({ kind: "unavailable" }),
  dispatch: () => Promise.resolve(null),
};

/** `undefined` (no notifier) for `none`, or when a provider is selected but not fully configured. */
function buildNotifier(
  env: Env,
  logger: EnquiryLogger,
  overrides: EnquiryServiceOverrides,
): Notifier | undefined {
  const { provider, apiKey, from } = env.email;
  if (provider === "console") return new ConsoleNotifier(logger);
  if (provider !== "postmark" && provider !== "resend") return undefined;
  const to = env.enquiry.notificationTo;
  if (!apiKey || !from || !to) {
    // The configuration rules already require these; this is defence in depth. Names only.
    logger.error("notifier.misconfigured", {
      provider,
      missing: !apiKey
        ? "EMAIL_PROVIDER_API_KEY"
        : !from
          ? "EMAIL_FROM"
          : "ENQUIRY_NOTIFICATION_TO",
    });
    return undefined;
  }
  const options = {
    apiKey,
    from,
    to,
    logger,
    ...(overrides.fetch ? { fetch: overrides.fetch } : {}),
  };
  return provider === "postmark" ? new PostmarkNotifier(options) : new ResendNotifier(options);
}

export function createEnquiryService(
  env: Env,
  overrides: EnquiryServiceOverrides = {},
): EnquiryService {
  const logger = overrides.logger ?? createEnquiryLogger({ env: env.deployEnv });

  let repository: EnquiryRepository;
  let outbox: OutboxStore;
  let limiter: RateLimiter;
  let salt: string;

  if (env.enquiry.backend === "memory") {
    const memory = memoryBackend();
    repository = memory.repository;
    outbox = memory.outbox;
    limiter = memory.limiter;
    salt = env.enquiry.ipHashSalt ?? memory.salt;
  } else if (env.enquiry.backend === "supabase") {
    const { url, secretKey } = env.supabase;
    const ipHashSalt = env.enquiry.ipHashSalt;
    if ((!overrides.rpcClient && (!url || !secretKey)) || !ipHashSalt) {
      // Without the salt the IP cannot be hashed safely, so the pipeline refuses to run.
      logger.error("enquiry.misconfigured", {
        missing: !ipHashSalt ? "ENQUIRY_IP_HASH_SALT" : "SUPABASE_URL/SUPABASE_SECRET_KEY",
      });
      return unavailable;
    }
    const client =
      overrides.rpcClient ??
      createSupabaseRpcClient({ url: url as string, secretKey: secretKey as string });
    repository = new SupabaseEnquiryRepository(client);
    outbox = new SupabaseOutboxStore(client);
    limiter = new PostgresRateLimiter(client);
    salt = ipHashSalt;
  } else {
    return unavailable;
  }

  const production = env.deployEnv === "production";
  if (production && (!env.turnstile.secretKey || !env.enquiry.privacyNoticeVersion)) {
    // Defence in depth behind the configuration rules: production never runs without a human
    // check and a pinned privacy notice version, whatever the environment says.
    logger.error("enquiry.misconfigured", {
      missing: !env.turnstile.secretKey ? "TURNSTILE_SECRET_KEY" : "ENQUIRY_PRIVACY_NOTICE_VERSION",
    });
    return unavailable;
  }

  // The hostname is pinned in production only: preview and staging deployments are served from
  // generated hostnames that do not match NEXT_PUBLIC_SITE_URL, so there the action is still
  // pinned but the hostname is not (documented risk in ADR-019). Production never gets the
  // disabled verifier.
  const verifier: HumanVerifier = env.turnstile.secretKey
    ? new TurnstileVerifier({
        secret: env.turnstile.secretKey,
        expectedHostname: production ? new URL(env.siteUrl).hostname : undefined,
        ...(overrides.fetch ? { fetch: overrides.fetch } : {}),
      })
    : new DisabledVerifier();

  const notifier: Notifier | undefined =
    overrides.notifier ?? buildNotifier(env, logger, overrides);

  return {
    available: true,
    receive: (request) =>
      receiveEnquiry(
        {
          repository,
          rateLimiter: limiter,
          verifier,
          logger,
          ipHashSalt: salt,
          privacyNoticeVersion: env.enquiry.privacyNoticeVersion,
        },
        request,
      ),
    dispatch: notifier
      ? () => dispatchOutbox({ store: outbox, notifier, logger })
      : () => Promise.resolve(null),
  };
}
