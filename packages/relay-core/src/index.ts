import "server-only";

/**
 * @vitalos/relay-core: Vitalos Relay server-side domain logic (ADR-035 to ADR-038).
 * Server-only. The browser imports `@vitalos/relay-core/contract` only.
 */
export * from "./contract";
export { RelayError, silentLogger } from "./services/context";
export type {
  HumanCheck,
  HumanVerifier,
  Logger,
  RelayConfig,
  RelayContext,
  RelayDeps,
  VisitorMailer,
} from "./services/context";
export {
  VisitorService,
  LIMITS as VISITOR_LIMITS,
  historyTurns,
  mergeTurns,
  toVisitorMessage,
} from "./services/visitor";
export type { ChatResult, RequestMeta } from "./services/visitor";
export { AdminService, adminMessage } from "./services/admin";
export type { BundledEntriesLoader, FaqRunSummary, FaqStatus, FaqSyncPort } from "./services/admin";
export { FaqSyncService } from "./services/faq-sync";
export type { SnapshotPort } from "./services/faq-sync";
export { CronService } from "./services/cron";
export { visitorReplyEmail } from "./services/visitor-email";

export { SupabaseRelayStore, RelayStoreError, escapeLike } from "./db/supabase";
export { MemoryRelayStore } from "./db/memory";
export type * from "./db/types";

export { DeepSeekProvider } from "./llm/deepseek";
export { MockProvider, mockAnswer } from "./llm/mock";
export type { LlmProvider, StreamEvent, Usage } from "./llm/provider";
export { estimateCostUsd, isPeak } from "./llm/provider";
export { SYSTEM_PROMPT, PRACTICES_FACT } from "./llm/prompts/system";
export { HANDOFF_MARKER, MarkerGuard, stripMarkers } from "./llm/markers";
export { finaliseCitations } from "./llm/citations";

export { HttpEmbedder, nullEmbedder } from "./retrieval/embed";
export type { Embedder } from "./retrieval/embed";
export { retrieve } from "./retrieval/search";

export { redact } from "./redact/redact";
export { isExplicitHandoffRequest, normaliseQuestion } from "./handoff/intent";

export { SupabaseBroadcaster, MemoryBroadcaster, adminTopic } from "./realtime/broadcast";
export type { Broadcaster } from "./realtime/broadcast";
export { WebhookAdminNotifier, MemoryAdminNotifier } from "./notify/webhook";
export type { AdminEvent, AdminNotifier } from "./notify/webhook";
export { canonicalString, sign, verifySignature, SIGNATURE_WINDOW_SECONDS } from "./notify/signing";
export { LogVisitorMailer, ResendVisitorMailer } from "./notify/mailer";

export { NotionFaqReader, DEFAULT_NOTION_VERSION } from "./knowledge/notion";

export * from "./schemas/api";
export {
  relaySettingsSchema,
  parseStoredSettings,
  DEFAULT_SUGGESTED_QUESTIONS,
  DEFAULT_GREETING,
} from "./schemas/settings";
export type { RelaySettings } from "./schemas/settings";
export { teamStatus, withinBusinessHours, deviceLabel } from "./util/team";
export { visitorLabel, initialsOf } from "./util/tokens";
