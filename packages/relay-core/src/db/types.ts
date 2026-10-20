import type {
  Citation,
  ConversationStatus,
  HandoffTrigger,
  NextStep,
  SenderType,
} from "../contract";
import type { KnowledgeType } from "../schemas/api";

export type KbSource = "repo" | "cms" | "team_answer" | "faq";
export type KbStatus = "draft" | "published" | "archived";

export interface ConversationRecord {
  id: string;
  visitorTokenHash: string;
  channelKey: string;
  status: ConversationStatus;
  /** Reference quoted by the visitor and staff once a person is involved; see services/case-id.ts. */
  caseId: string | null;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  assignedAdminInitials: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactCompany: string | null;
  consentAt: string | null;
  consentNoticeVersion: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  referrer: string | null;
  utm: Record<string, string>;
  userAgent: string | null;
  device: string | null;
  country: string | null;
  ipHash: string | null;
  aiTurns: number;
  lastMessageAt: string;
  lastVisitorSeenAt: string | null;
  adminLastReadAt: string | null;
  firstAdminJoinedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  summary: string | null;
  summaryMeta: SummaryMeta | null;
  tags: string[];
  createdAt: string;
}

/** Outcome of `assignCaseId`: the ID now on the conversation, a collision, or no such conversation. */
export type CaseIdAssignment =
  | { result: "assigned"; caseId: string }
  | { result: "existing"; caseId: string }
  | { result: "collision" }
  | { result: "missing" };

export interface SummaryMeta {
  intent: string;
  sector: string | null;
  urgency: "low" | "normal" | "high";
}

export type NewConversation = Pick<
  ConversationRecord,
  | "visitorTokenHash"
  | "channelKey"
  | "pageUrl"
  | "pageTitle"
  | "referrer"
  | "utm"
  | "userAgent"
  | "device"
  | "country"
  | "ipHash"
>;

export type ConversationPatch = Partial<
  Omit<ConversationRecord, "id" | "channelKey" | "createdAt">
>;

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderType: SenderType;
  adminId: string | null;
  adminName: string | null;
  adminInitials: string | null;
  body: string;
  bodyRedacted: string | null;
  meta: Record<string, unknown>;
  citations: StoredCitation[];
  confidence: number | null;
  handoffSuggested: boolean;
  truncated: boolean;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  cacheHitTokens: number | null;
  latencyMs: number | null;
  firstTokenMs: number | null;
  feedback: -1 | 1 | null;
  feedbackAt: string | null;
  clientMessageId: string | null;
  createdAt: string;
}

export interface StoredCitation extends Citation {
  documentId: string;
  chunkId: string;
}

/** `id` may be supplied so a streamed answer keeps the id announced in its `meta` event. */
export type NewMessage = Pick<MessageRecord, "conversationId" | "senderType" | "body"> &
  Partial<Omit<MessageRecord, "conversationId" | "senderType" | "body" | "createdAt">>;

export type MessagePatch = Partial<Omit<MessageRecord, "id" | "conversationId" | "createdAt">>;

export interface HandoffRecord {
  id: string;
  conversationId: string;
  trigger: HandoffTrigger;
  messageId: string | null;
  requestedAt: string;
  joinedBy: string | null;
  joinedAt: string | null;
  resolvedAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
}

export interface KbDocumentRecord {
  id: string;
  source: KbSource;
  sourceRef: string;
  externalId: string | null;
  title: string;
  url: string | null;
  type: KnowledgeType;
  bodyMd: string;
  checksum: string;
  status: KbStatus;
  owner: string | null;
  reviewDate: string | null;
  updatedBy: string | null;
  meta: KbPublicMeta;
  adminMeta: KbAdminMeta;
  createdAt: string;
  updatedAt: string;
}

/** Public metadata: may reach the prompt and the widget (citation links, NEXT STEP, START WITH). */
export interface KbPublicMeta {
  section?: string;
  section_order?: number;
  page_placements?: string[];
  canonical_path?: string | null;
  linked_cta?: string | null;
  next_step?: NextStep | null;
  audience_tags?: string[];
  notion_url?: string;
  notion_last_edited_at?: string | null;
  faq_status?: "Verified" | "Needs confirmation";
  /** Repo/CMS: where the entry came from, for the admin's read-only link. */
  origin_path?: string;
}

/** Admin-only metadata: never selected by retrieval, prompt building or visitor APIs. */
export interface KbAdminMeta {
  source_refs?: string;
  confirm_note?: string | null;
  hold_reasons?: string[];
  needs_confirmation?: boolean;
  awaiting_sign_off?: boolean;
  [key: string]: unknown;
}

export type UpsertKbDocument = Omit<KbDocumentRecord, "id" | "createdAt" | "updatedAt">;

export interface KbChunkInput {
  ix: number;
  heading: string;
  content: string;
  tokenCount: number;
  embedding: number[] | null;
}

export interface MatchedChunk {
  chunkId: string;
  documentId: string;
  title: string;
  url: string | null;
  type: KnowledgeType;
  source: KbSource;
  externalId: string | null;
  heading: string;
  content: string;
  meta: KbPublicMeta;
  rrfScore: number;
  similarity: number | null;
  ftsRank: number | null;
}

export interface MatchParams {
  queryText: string;
  embedding: number[] | null;
  matchCount: number;
  rrfK?: number;
  pagePath?: string | null;
  pageBonus?: number;
}

export interface KbDocumentFilter {
  source?: KbSource;
  status?: KbStatus;
  section?: string;
  q?: string;
}

export interface KbDocumentListItem extends Omit<KbDocumentRecord, "bodyMd" | "adminMeta"> {
  chunks: number;
}

export interface GapRecord {
  id: string;
  questionNorm: string;
  exampleQuestion: string;
  count: number;
  lastAskedAt: string;
  exampleConversationId: string | null;
  status: "open" | "answered" | "ignored";
}

export interface SyncRunRecord {
  id: string;
  source: KbSource;
  startedAt: string;
  finishedAt: string | null;
  mode: "incremental" | "full" | "snapshot";
  added: number;
  updated: number;
  archived: number;
  held: number;
  skippedUnverified: number;
  errors: string[];
}

export interface PresenceRecord {
  adminId: string;
  name: string;
  initials: string;
  available: boolean;
  lastSeenAt: string;
}

export interface UsageRecord {
  day: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  cacheHitTokens: number;
  estCostUsd: number;
  capNotifiedAt: string | null;
}

export interface EmailOutboxRecord {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  provider: "log" | "resend" | "postmark" | "console";
  status: "queued" | "sent" | "failed" | "logged";
  providerMessageId: string | null;
  conversationId: string | null;
  createdAt: string;
}

export type InboxTab = "needs" | "live" | "ai" | "closed";

export interface InboxListParams {
  tab: InboxTab;
  q?: string | undefined;
  limit: number;
  /** Opaque cursor from the previous page. */
  cursor?: string | undefined;
}

export interface InboxRow {
  conversation: ConversationRecord;
  lastMessage: { body: string; senderType: SenderType; at: string } | null;
  waitingSince: string | null;
  handoffTrigger: HandoffTrigger | null;
}

export interface InsightsRow {
  conversations: number;
  aiResolved: number;
  handoffs: number;
  helpful: number;
  notHelpful: number;
  medianFirstReplySeconds: number | null;
  waitingNow: number;
  topQuestions: { question: string; count: number }[];
  tokensIn: number;
  tokensOut: number;
  cacheHitTokens: number;
  estCostUsd: number;
}

/**
 * Persistence port for Relay. `SupabaseRelayStore` is the production adapter; `MemoryRelayStore`
 * serves tests, Storybook and the browser suites (never production).
 */
export interface RelayStore {
  // Conversations
  createConversation(input: NewConversation): Promise<ConversationRecord>;
  getConversation(id: string): Promise<ConversationRecord | null>;
  /** Applies the patch; with `expectStatus`, only when the current status is one of them. */
  updateConversation(
    id: string,
    patch: ConversationPatch,
    expectStatus?: readonly ConversationRecord["status"][],
  ): Promise<ConversationRecord | null>;
  /** Sets the case ID only while the conversation has none; otherwise reports the existing one. */
  assignCaseId(id: string, candidate: string): Promise<CaseIdAssignment>;
  deleteConversation(id: string): Promise<boolean>;
  listInbox(params: InboxListParams): Promise<{ rows: InboxRow[]; nextCursor: string | null }>;
  inboxCounts(): Promise<Record<InboxTab, number>>;

  // Messages
  /** Idempotent by (conversationId, clientMessageId): returns the existing row on replay. */
  insertMessage(input: NewMessage): Promise<{ message: MessageRecord; duplicate: boolean }>;
  getMessage(id: string): Promise<MessageRecord | null>;
  updateMessage(id: string, patch: MessagePatch): Promise<MessageRecord | null>;
  listMessages(
    conversationId: string,
    opts?: { after?: string; limit?: number },
  ): Promise<MessageRecord[]>;

  // Hand-offs
  createHandoff(input: {
    conversationId: string;
    trigger: HandoffTrigger;
    messageId: string | null;
  }): Promise<HandoffRecord>;
  openHandoff(conversationId: string): Promise<HandoffRecord | null>;
  updateHandoff(
    id: string,
    patch: Partial<Omit<HandoffRecord, "id" | "conversationId">>,
  ): Promise<void>;
  listOpenHandoffs(): Promise<HandoffRecord[]>;

  // Knowledge
  upsertDocument(
    doc: UpsertKbDocument,
  ): Promise<{ document: KbDocumentRecord; changed: boolean; created: boolean }>;
  replaceChunks(documentId: string, chunks: KbChunkInput[]): Promise<void>;
  getDocument(id: string): Promise<KbDocumentRecord | null>;
  getDocumentBySourceRef(sourceRef: string): Promise<KbDocumentRecord | null>;
  getDocumentByExternalId(source: KbSource, externalId: string): Promise<KbDocumentRecord | null>;
  listDocuments(filter: KbDocumentFilter): Promise<KbDocumentListItem[]>;
  setDocumentStatus(
    id: string,
    status: KbStatus,
    updatedBy: string | null,
  ): Promise<KbDocumentRecord | null>;
  /** Source refs currently stored for a source (for archiving entries that disappeared). */
  listSourceRefs(source: KbSource): Promise<{ id: string; sourceRef: string; status: KbStatus }[]>;
  matchChunks(params: MatchParams): Promise<MatchedChunk[]>;
  /** Public FAQ questions placed on a page (START WITH). Published FAQ documents only. */
  faqQuestionsForPage(
    pagePath: string,
    limit: number,
  ): Promise<{ question: string; placements: string[]; sectionOrder: number }[]>;
  listChunksForDocument(
    documentId: string,
  ): Promise<{ ix: number; heading: string; content: string; hasEmbedding: boolean }[]>;
  /** ADMIN ONLY (FAQ Needs confirmation / Held views). Never called by retrieval or visitor code. */
  listAdminMetaForSource(source: KbSource): Promise<
    {
      id: string;
      externalId: string | null;
      title: string;
      status: KbStatus;
      meta: KbPublicMeta;
      adminMeta: KbAdminMeta;
    }[]
  >;

  // Gaps and sync runs
  recordGap(questionNorm: string, example: string, conversationId: string | null): Promise<void>;
  listGaps(sinceIso: string): Promise<GapRecord[]>;
  setGapStatus(id: string, status: GapRecord["status"]): Promise<void>;
  startSyncRun(source: KbSource, mode: SyncRunRecord["mode"]): Promise<SyncRunRecord>;
  finishSyncRun(run: SyncRunRecord): Promise<void>;
  lastSyncRuns(source: KbSource, limit: number): Promise<SyncRunRecord[]>;

  // Presence, settings, usage, limits, audit, outbox, resume tokens
  heartbeat(
    admin: { adminId: string; name: string; initials: string },
    available?: boolean,
  ): Promise<PresenceRecord>;
  listPresence(): Promise<PresenceRecord[]>;
  getSettingsConfig(): Promise<unknown>;
  putSettingsConfig(config: unknown, updatedBy: string | null): Promise<void>;
  addUsage(
    day: string,
    tokensIn: number,
    tokensOut: number,
    cacheHit: number,
    costUsd: number,
  ): Promise<UsageRecord>;
  getUsage(day: string): Promise<UsageRecord | null>;
  markCapNotified(day: string): Promise<boolean>;
  hitRateLimit(key: string, windowSeconds: number, max: number): Promise<boolean>;
  audit(entry: {
    actorAdminId: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
  }): Promise<void>;
  insertEmail(email: Omit<EmailOutboxRecord, "id" | "createdAt">): Promise<EmailOutboxRecord>;
  listEmails(limit: number): Promise<EmailOutboxRecord[]>;
  insertResumeToken(tokenHash: string, conversationId: string, expiresAt: string): Promise<void>;
  /** Marks a valid, unused, unexpired token used and returns its conversation id. */
  consumeResumeToken(tokenHash: string, nowIso: string): Promise<string | null>;
  insights(sinceIso: string): Promise<InsightsRow>;
}
