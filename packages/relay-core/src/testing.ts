/**
 * Test helpers: an in-memory Relay context (memory store, mock provider, recording broadcaster
 * and notifier). Used by unit tests, Storybook and the browser suites; never in production.
 */
import { MemoryRelayStore } from "./db/memory";
import { MockProvider } from "./llm/mock";
import { MemoryAdminNotifier } from "./notify/webhook";
import { LogVisitorMailer } from "./notify/mailer";
import { MemoryBroadcaster } from "./realtime/broadcast";
import { nullEmbedder } from "./retrieval/embed";
import type { RelayConfig, RelayContext } from "./services/context";
import { silentLogger } from "./services/context";

export const testConfig: RelayConfig = {
  deployEnv: "local",
  aiEnabled: true,
  model: "deepseek-flash",
  summaryModel: "deepseek-flash",
  simFloor: 0.7,
  dailyTokenCap: 2_000_000,
  tokenPepper: "test-pepper-test-pepper-test-pepper-00",
  ipSalt: "test-salt-test-salt-00",
  allowedOrigins: ["http://localhost:3000"],
  privacyNoticeVersion: "2026-10",
  privacyUrl: "/legal/privacy",
  realtime: null,
  publicSiteUrl: "http://localhost:3000",
  adminBaseUrl: "http://localhost:8000",
  turnstileRequired: false,
  visitorEmailsEnabled: false,
  faq: { requireHubActive: false },
};

export function memoryContext(overrides: Partial<RelayConfig> = {}, now?: () => Date) {
  const store = new MemoryRelayStore(now ? { now } : {});
  const broadcaster = new MemoryBroadcaster();
  const notifier = new MemoryAdminNotifier();
  const pending: Promise<unknown>[] = [];
  const ctx: RelayContext = {
    config: { ...testConfig, ...overrides },
    deps: {
      store,
      llm: new MockProvider(),
      embedder: nullEmbedder,
      broadcaster,
      notifier,
      human: { verify: () => Promise.resolve("disabled") },
      mailer: new LogVisitorMailer(store),
      logger: silentLogger,
      now: now ?? (() => new Date()),
      defer: (task) => {
        pending.push(task());
      },
    },
  };
  /** Waits for deferred work (after-response tasks). */
  const settle = async () => {
    while (pending.length) await Promise.allSettled(pending.splice(0));
  };
  return { ctx, store, broadcaster, notifier, settle };
}
