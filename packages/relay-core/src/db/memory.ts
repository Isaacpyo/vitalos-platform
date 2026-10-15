import type { ConversationStatus } from "../contract";
import type {
  ConversationPatch,
  ConversationRecord,
  EmailOutboxRecord,
  GapRecord,
  HandoffRecord,
  InboxListParams,
  InboxRow,
  InboxTab,
  InsightsRow,
  KbChunkInput,
  KbDocumentFilter,
  KbDocumentListItem,
  KbDocumentRecord,
  KbSource,
  KbStatus,
  MatchParams,
  MatchedChunk,
  MessagePatch,
  MessageRecord,
  NewConversation,
  NewMessage,
  PresenceRecord,
  RelayStore,
  SyncRunRecord,
  UpsertKbDocument,
  UsageRecord,
} from "./types";

interface StoredChunk extends KbChunkInput {
  id: string;
  documentId: string;
}

const STOPWORDS = new Set(
  "a an and are as at be by can do does for from has have how i in is it its me my of on or our so that the this to we what when where which who why will with you your".split(
    " ",
  ),
);

/** Rough English stem (enough for tests): lower case, strip common suffixes. */
export function stem(word: string): string {
  return word
    .toLowerCase()
    .replace(/(ing|edly|ed|ies|es|s)$/u, (m) => (m === "ies" ? "y" : ""))
    .slice(0, 12);
}

export function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((w) => !STOPWORDS.has(w) && w.length > 1)
    .map(stem);
}

const STATUS_FOR_TAB: Record<InboxTab, ConversationStatus> = {
  needs: "awaiting_human",
  live: "human",
  ai: "ai",
  closed: "closed",
};

/**
 * In-memory `RelayStore` for unit tests, Storybook and browser suites (RELAY_STORE=memory, never
 * production). Matching approximates the SQL: a term-overlap full-text score and cosine
 * similarity, fused with the same reciprocal rank fusion and page bonus.
 */
export class MemoryRelayStore implements RelayStore {
  conversations = new Map<string, ConversationRecord>();
  messages = new Map<string, MessageRecord>();
  handoffs = new Map<string, HandoffRecord>();
  documents = new Map<string, KbDocumentRecord>();
  chunks = new Map<string, StoredChunk>();
  gaps = new Map<string, GapRecord>();
  syncRuns: SyncRunRecord[] = [];
  presence = new Map<string, PresenceRecord>();
  settings: unknown = {};
  usage = new Map<string, UsageRecord>();
  limits = new Map<string, number>();
  auditLog: {
    actorAdminId: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
    at: string;
  }[] = [];
  emails: EmailOutboxRecord[] = [];
  resumeTokens = new Map<
    string,
    { conversationId: string; expiresAt: string; usedAt: string | null }
  >();
  private clock: () => Date;
  private seq = 0;

  constructor(options: { now?: () => Date } = {}) {
    this.clock = options.now ?? (() => new Date());
  }

  private now(): string {
    // Strictly increasing timestamps keep ordering deterministic within one millisecond.
    const base = this.clock().getTime();
    this.seq += 1;
    return new Date(base + this.seq / 1000).toISOString();
  }

  // -------------------------------------------------------------------------------------------
  createConversation(input: NewConversation): Promise<ConversationRecord> {
    const now = this.now();
    const record: ConversationRecord = {
      id: crypto.randomUUID(),
      status: "ai",
      assignedAdminId: null,
      assignedAdminName: null,
      assignedAdminInitials: null,
      contactName: null,
      contactEmail: null,
      contactCompany: null,
      consentAt: null,
      consentNoticeVersion: null,
      aiTurns: 0,
      lastMessageAt: now,
      lastVisitorSeenAt: now,
      adminLastReadAt: null,
      firstAdminJoinedAt: null,
      closedAt: null,
      closedReason: null,
      summary: null,
      summaryMeta: null,
      tags: [],
      createdAt: now,
      ...input,
    };
    this.conversations.set(record.id, record);
    return Promise.resolve({ ...record });
  }

  getConversation(id: string): Promise<ConversationRecord | null> {
    const c = this.conversations.get(id);
    return Promise.resolve(c ? { ...c } : null);
  }

  updateConversation(
    id: string,
    patch: ConversationPatch,
    expectStatus?: readonly ConversationStatus[],
  ): Promise<ConversationRecord | null> {
    const c = this.conversations.get(id);
    if (!c) return Promise.resolve(null);
    if (expectStatus && expectStatus.length > 0 && !expectStatus.includes(c.status))
      return Promise.resolve(null);
    const next = { ...c, ...stripUndefined(patch) };
    this.conversations.set(id, next);
    return Promise.resolve({ ...next });
  }

  deleteConversation(id: string): Promise<boolean> {
    const existed = this.conversations.delete(id);
    for (const [mid, m] of this.messages) if (m.conversationId === id) this.messages.delete(mid);
    for (const [hid, h] of this.handoffs) if (h.conversationId === id) this.handoffs.delete(hid);
    for (const [t, r] of this.resumeTokens)
      if (r.conversationId === id) this.resumeTokens.delete(t);
    return Promise.resolve(existed);
  }

  private lastMessage(conversationId: string): MessageRecord | null {
    let last: MessageRecord | null = null;
    for (const m of this.messages.values()) {
      if (m.conversationId !== conversationId || !["visitor", "ai", "admin"].includes(m.senderType))
        continue;
      if (!last || m.createdAt > last.createdAt) last = m;
    }
    return last;
  }

  async listInbox(
    params: InboxListParams,
  ): Promise<{ rows: InboxRow[]; nextCursor: string | null }> {
    const status = STATUS_FOR_TAB[params.tab];
    const q = params.q?.toLowerCase().trim();
    const rows: (InboxRow & { sortTs: string })[] = [];
    for (const c of this.conversations.values()) {
      if (c.status !== status) continue;
      if (q) {
        const inMessages = [...this.messages.values()].some(
          (m) =>
            m.conversationId === c.id &&
            m.senderType !== "note" &&
            m.senderType !== "system" &&
            m.body.toLowerCase().includes(q),
        );
        if (
          !c.contactName?.toLowerCase().includes(q) &&
          !c.contactEmail?.toLowerCase().includes(q) &&
          !inMessages
        )
          continue;
      }
      const open = await this.openHandoff(c.id);
      const last = this.lastMessage(c.id);
      rows.push({
        conversation: { ...c },
        lastMessage: last
          ? { body: last.body.slice(0, 140), senderType: last.senderType, at: last.createdAt }
          : null,
        waitingSince: open?.requestedAt ?? null,
        handoffTrigger: open?.trigger ?? null,
        sortTs: params.tab === "needs" ? (open?.requestedAt ?? c.lastMessageAt) : c.lastMessageAt,
      });
    }
    rows.sort((a, b) =>
      params.tab === "needs"
        ? a.sortTs.localeCompare(b.sortTs) || a.conversation.id.localeCompare(b.conversation.id)
        : b.sortTs.localeCompare(a.sortTs) || b.conversation.id.localeCompare(a.conversation.id),
    );
    const start = params.cursor ? Number(params.cursor) : 0;
    const page = rows.slice(start, start + params.limit).map(({ sortTs: _s, ...r }) => {
      void _s;
      return r;
    });
    const nextCursor = start + params.limit < rows.length ? String(start + params.limit) : null;
    return { rows: page, nextCursor };
  }

  inboxCounts(): Promise<Record<InboxTab, number>> {
    const counts: Record<InboxTab, number> = { needs: 0, live: 0, ai: 0, closed: 0 };
    for (const c of this.conversations.values()) {
      const tab = (Object.keys(STATUS_FOR_TAB) as InboxTab[]).find(
        (t) => STATUS_FOR_TAB[t] === c.status,
      );
      if (tab) counts[tab] += 1;
    }
    return Promise.resolve(counts);
  }

  // -------------------------------------------------------------------------------------------
  insertMessage(input: NewMessage): Promise<{ message: MessageRecord; duplicate: boolean }> {
    if (input.clientMessageId) {
      for (const m of this.messages.values()) {
        if (
          m.conversationId === input.conversationId &&
          m.clientMessageId === input.clientMessageId
        ) {
          return Promise.resolve({ message: { ...m }, duplicate: true });
        }
      }
    }
    const message: MessageRecord = {
      id: crypto.randomUUID(),
      adminId: null,
      adminName: null,
      adminInitials: null,
      bodyRedacted: null,
      meta: {},
      citations: [],
      confidence: null,
      handoffSuggested: false,
      truncated: false,
      model: null,
      tokensIn: null,
      tokensOut: null,
      cacheHitTokens: null,
      latencyMs: null,
      firstTokenMs: null,
      feedback: null,
      feedbackAt: null,
      clientMessageId: null,
      createdAt: this.now(),
      ...stripUndefined(input),
    } as MessageRecord;
    this.messages.set(message.id, message);
    return Promise.resolve({ message: { ...message }, duplicate: false });
  }

  getMessage(id: string): Promise<MessageRecord | null> {
    const m = this.messages.get(id);
    return Promise.resolve(m ? { ...m } : null);
  }

  updateMessage(id: string, patch: MessagePatch): Promise<MessageRecord | null> {
    const m = this.messages.get(id);
    if (!m) return Promise.resolve(null);
    const next = { ...m, ...stripUndefined(patch) };
    this.messages.set(id, next);
    return Promise.resolve({ ...next });
  }

  listMessages(
    conversationId: string,
    opts: { after?: string; limit?: number } = {},
  ): Promise<MessageRecord[]> {
    const list = [...this.messages.values()]
      .filter(
        (m) => m.conversationId === conversationId && (!opts.after || m.createdAt > opts.after),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, opts.limit ?? 500)
      .map((m) => ({ ...m }));
    return Promise.resolve(list);
  }

  // -------------------------------------------------------------------------------------------
  createHandoff(input: {
    conversationId: string;
    trigger: HandoffRecord["trigger"];
    messageId: string | null;
  }): Promise<HandoffRecord> {
    const h: HandoffRecord = {
      id: crypto.randomUUID(),
      requestedAt: this.now(),
      joinedBy: null,
      joinedAt: null,
      resolvedAt: null,
      reminderCount: 0,
      lastReminderAt: null,
      ...input,
    };
    this.handoffs.set(h.id, h);
    return Promise.resolve({ ...h });
  }

  openHandoff(conversationId: string): Promise<HandoffRecord | null> {
    const open = [...this.handoffs.values()]
      .filter((h) => h.conversationId === conversationId && !h.resolvedAt)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
    return Promise.resolve(open ? { ...open } : null);
  }

  updateHandoff(
    id: string,
    patch: Partial<Omit<HandoffRecord, "id" | "conversationId">>,
  ): Promise<void> {
    const h = this.handoffs.get(id);
    if (h) this.handoffs.set(id, { ...h, ...stripUndefined(patch) });
    return Promise.resolve();
  }

  listOpenHandoffs(): Promise<HandoffRecord[]> {
    return Promise.resolve(
      [...this.handoffs.values()]
        .filter((h) => !h.joinedAt && !h.resolvedAt)
        .map((h) => ({ ...h })),
    );
  }

  // -------------------------------------------------------------------------------------------
  async upsertDocument(
    doc: UpsertKbDocument,
  ): Promise<{ document: KbDocumentRecord; changed: boolean; created: boolean }> {
    const current =
      (await this.getDocumentBySourceRef(doc.sourceRef)) ??
      (doc.externalId ? await this.getDocumentByExternalId(doc.source, doc.externalId) : null);
    const now = this.now();
    if (!current) {
      const created: KbDocumentRecord = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...doc,
      };
      this.documents.set(created.id, created);
      return { document: { ...created }, changed: true, created: true };
    }
    const changed =
      current.checksum !== doc.checksum ||
      current.status !== doc.status ||
      current.sourceRef !== doc.sourceRef ||
      JSON.stringify(current.adminMeta) !== JSON.stringify(doc.adminMeta) ||
      JSON.stringify(current.meta) !== JSON.stringify(doc.meta);
    if (!changed) return { document: current, changed: false, created: false };
    const next = { ...current, ...doc, updatedAt: now };
    this.documents.set(current.id, next);
    return { document: { ...next }, changed: current.checksum !== doc.checksum, created: false };
  }

  replaceChunks(documentId: string, chunks: KbChunkInput[]): Promise<void> {
    for (const [id, c] of this.chunks) if (c.documentId === documentId) this.chunks.delete(id);
    for (const c of chunks) {
      const id = crypto.randomUUID();
      this.chunks.set(id, { ...c, id, documentId });
    }
    return Promise.resolve();
  }

  getDocument(id: string): Promise<KbDocumentRecord | null> {
    const d = this.documents.get(id);
    return Promise.resolve(d ? { ...d } : null);
  }

  getDocumentBySourceRef(sourceRef: string): Promise<KbDocumentRecord | null> {
    const d = [...this.documents.values()].find((x) => x.sourceRef === sourceRef);
    return Promise.resolve(d ? { ...d } : null);
  }

  getDocumentByExternalId(source: KbSource, externalId: string): Promise<KbDocumentRecord | null> {
    const d = [...this.documents.values()].find(
      (x) => x.source === source && x.externalId === externalId,
    );
    return Promise.resolve(d ? { ...d } : null);
  }

  listDocuments(filter: KbDocumentFilter): Promise<KbDocumentListItem[]> {
    const q = filter.q?.toLowerCase();
    const list = [...this.documents.values()]
      .filter(
        (d) =>
          (!filter.source || d.source === filter.source) &&
          (!filter.status || d.status === filter.status) &&
          (!filter.section || d.meta.section === filter.section) &&
          (!q || d.title.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ bodyMd: _b, adminMeta: _a, ...d }) => {
        void _b;
        void _a;
        return {
          ...d,
          chunks: [...this.chunks.values()].filter((c) => c.documentId === d.id).length,
        };
      });
    return Promise.resolve(list);
  }

  setDocumentStatus(
    id: string,
    status: KbStatus,
    updatedBy: string | null,
  ): Promise<KbDocumentRecord | null> {
    const d = this.documents.get(id);
    if (!d) return Promise.resolve(null);
    const next = { ...d, status, updatedBy, updatedAt: this.now() };
    this.documents.set(id, next);
    return Promise.resolve({ ...next });
  }

  listSourceRefs(source: KbSource): Promise<{ id: string; sourceRef: string; status: KbStatus }[]> {
    return Promise.resolve(
      [...this.documents.values()]
        .filter((d) => d.source === source)
        .map((d) => ({ id: d.id, sourceRef: d.sourceRef, status: d.status })),
    );
  }

  matchChunks(params: MatchParams): Promise<MatchedChunk[]> {
    const k = params.rrfK ?? 50;
    const bonus = params.pageBonus ?? 0.25;
    const qTerms = new Set(terms(params.queryText));
    const published = [...this.chunks.values()].filter(
      (c) => this.documents.get(c.documentId)?.status === "published",
    );

    const fts = published
      .map((c) => {
        const heading = terms(c.heading);
        const body = terms(c.content);
        let score = 0;
        for (const t of qTerms) {
          if (heading.includes(t)) score += 0.2;
          if (body.includes(t)) score += 0.1;
        }
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id))
      .slice(0, params.matchCount * 4);

    const sem = params.embedding
      ? published
          .filter((c) => c.embedding)
          .map((c) => ({ c, sim: dot(c.embedding as number[], params.embedding as number[]) }))
          .sort((a, b) => b.sim - a.sim || a.c.id.localeCompare(b.c.id))
          .slice(0, params.matchCount * 4)
      : [];

    const fused = new Map<
      string,
      { c: StoredChunk; score: number; sim: number | null; rank: number | null }
    >();
    fts.forEach((x, i) =>
      fused.set(x.c.id, { c: x.c, score: 1 / (k + i + 1), sim: null, rank: x.score }),
    );
    sem.forEach((x, i) => {
      const prev = fused.get(x.c.id);
      fused.set(x.c.id, {
        c: x.c,
        score: (prev?.score ?? 0) + 1 / (k + i + 1),
        sim: x.sim,
        rank: prev?.rank ?? null,
      });
    });

    const out = [...fused.values()]
      .map((f) => {
        const d = this.documents.get(f.c.documentId) as KbDocumentRecord;
        const onPage = params.pagePath && d.meta.page_placements?.includes(params.pagePath);
        return {
          chunkId: f.c.id,
          documentId: d.id,
          title: d.title,
          url: d.url,
          type: d.type,
          source: d.source,
          externalId: d.externalId,
          heading: f.c.heading,
          content: f.c.content,
          meta: d.meta,
          rrfScore: f.score + (onPage ? bonus / (k + 1) : 0),
          similarity: f.sim,
          ftsRank: f.rank,
        } satisfies MatchedChunk;
      })
      .sort((a, b) => b.rrfScore - a.rrfScore || a.chunkId.localeCompare(b.chunkId))
      .slice(0, params.matchCount);
    return Promise.resolve(out);
  }

  faqQuestionsForPage(pagePath: string, limit: number) {
    return Promise.resolve(
      [...this.documents.values()]
        .filter(
          (d) =>
            d.source === "faq" &&
            d.status === "published" &&
            d.meta.page_placements?.includes(pagePath),
        )
        .map((d) => ({
          question: d.title,
          placements: d.meta.page_placements ?? [],
          sectionOrder: d.meta.section_order ?? 99,
        }))
        .slice(0, Math.max(limit * 10, limit)),
    );
  }

  listChunksForDocument(documentId: string) {
    return Promise.resolve(
      [...this.chunks.values()]
        .filter((c) => c.documentId === documentId)
        .sort((a, b) => a.ix - b.ix)
        .map((c) => ({
          ix: c.ix,
          heading: c.heading,
          content: c.content,
          hasEmbedding: c.embedding !== null,
        })),
    );
  }

  // -------------------------------------------------------------------------------------------
  recordGap(questionNorm: string, example: string, conversationId: string | null): Promise<void> {
    const key = questionNorm.slice(0, 300);
    const g = [...this.gaps.values()].find((x) => x.questionNorm === key);
    if (g) {
      this.gaps.set(g.id, {
        ...g,
        count: g.count + 1,
        lastAskedAt: this.now(),
        exampleConversationId: conversationId,
        status: g.status === "answered" ? "open" : g.status,
      });
    } else {
      const id = crypto.randomUUID();
      this.gaps.set(id, {
        id,
        questionNorm: key,
        exampleQuestion: example.slice(0, 500),
        count: 1,
        lastAskedAt: this.now(),
        exampleConversationId: conversationId,
        status: "open",
      });
    }
    return Promise.resolve();
  }

  listGaps(sinceIso: string): Promise<GapRecord[]> {
    return Promise.resolve(
      [...this.gaps.values()]
        .filter((g) => g.lastAskedAt >= sinceIso && g.status === "open")
        .sort((a, b) => b.count - a.count),
    );
  }

  setGapStatus(id: string, status: GapRecord["status"]): Promise<void> {
    const g = this.gaps.get(id);
    if (g) this.gaps.set(id, { ...g, status });
    return Promise.resolve();
  }

  startSyncRun(source: KbSource, mode: SyncRunRecord["mode"]): Promise<SyncRunRecord> {
    const run: SyncRunRecord = {
      id: crypto.randomUUID(),
      source,
      mode,
      startedAt: this.now(),
      finishedAt: null,
      added: 0,
      updated: 0,
      archived: 0,
      held: 0,
      skippedUnverified: 0,
      errors: [],
    };
    this.syncRuns.push(run);
    return Promise.resolve({ ...run });
  }

  finishSyncRun(run: SyncRunRecord): Promise<void> {
    const i = this.syncRuns.findIndex((r) => r.id === run.id);
    if (i >= 0) this.syncRuns[i] = { ...run, finishedAt: run.finishedAt ?? this.now() };
    return Promise.resolve();
  }

  lastSyncRuns(source: KbSource, limit: number): Promise<SyncRunRecord[]> {
    return Promise.resolve(
      this.syncRuns
        .filter((r) => r.source === source)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, limit),
    );
  }

  // -------------------------------------------------------------------------------------------
  heartbeat(
    admin: { adminId: string; name: string; initials: string },
    available?: boolean,
  ): Promise<PresenceRecord> {
    const prev = this.presence.get(admin.adminId);
    const next: PresenceRecord = {
      ...admin,
      available: available ?? prev?.available ?? false,
      lastSeenAt: this.now(),
    };
    this.presence.set(admin.adminId, next);
    return Promise.resolve({ ...next });
  }

  listPresence(): Promise<PresenceRecord[]> {
    return Promise.resolve([...this.presence.values()].map((p) => ({ ...p })));
  }

  getSettingsConfig(): Promise<unknown> {
    return Promise.resolve(structuredClone(this.settings));
  }

  putSettingsConfig(config: unknown): Promise<void> {
    this.settings = structuredClone(config);
    return Promise.resolve();
  }

  addUsage(
    day: string,
    tokensIn: number,
    tokensOut: number,
    cacheHit: number,
    costUsd: number,
  ): Promise<UsageRecord> {
    const u = this.usage.get(day) ?? {
      day,
      requests: 0,
      tokensIn: 0,
      tokensOut: 0,
      cacheHitTokens: 0,
      estCostUsd: 0,
      capNotifiedAt: null,
    };
    const next = {
      ...u,
      requests: u.requests + 1,
      tokensIn: u.tokensIn + tokensIn,
      tokensOut: u.tokensOut + tokensOut,
      cacheHitTokens: u.cacheHitTokens + cacheHit,
      estCostUsd: u.estCostUsd + costUsd,
    };
    this.usage.set(day, next);
    return Promise.resolve({ ...next });
  }

  getUsage(day: string): Promise<UsageRecord | null> {
    const u = this.usage.get(day);
    return Promise.resolve(u ? { ...u } : null);
  }

  markCapNotified(day: string): Promise<boolean> {
    const u = this.usage.get(day);
    if (!u || u.capNotifiedAt) return Promise.resolve(false);
    this.usage.set(day, { ...u, capNotifiedAt: this.now() });
    return Promise.resolve(true);
  }

  hitRateLimit(key: string, windowSeconds: number, max: number): Promise<boolean> {
    const window = Math.floor(this.clock().getTime() / 1000 / windowSeconds);
    const k = `${key}@${windowSeconds}:${window}`;
    const count = (this.limits.get(k) ?? 0) + 1;
    this.limits.set(k, count);
    return Promise.resolve(count <= max);
  }

  audit(entry: {
    actorAdminId: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    this.auditLog.push({ ...entry, at: this.now() });
    return Promise.resolve();
  }

  insertEmail(email: Omit<EmailOutboxRecord, "id" | "createdAt">): Promise<EmailOutboxRecord> {
    const record = { ...email, id: crypto.randomUUID(), createdAt: this.now() };
    this.emails.push(record);
    return Promise.resolve({ ...record });
  }

  listEmails(limit: number): Promise<EmailOutboxRecord[]> {
    return Promise.resolve([...this.emails].reverse().slice(0, limit));
  }

  insertResumeToken(tokenHash: string, conversationId: string, expiresAt: string): Promise<void> {
    this.resumeTokens.set(tokenHash, { conversationId, expiresAt, usedAt: null });
    return Promise.resolve();
  }

  consumeResumeToken(tokenHash: string, nowIso: string): Promise<string | null> {
    const t = this.resumeTokens.get(tokenHash);
    if (!t || t.usedAt || t.expiresAt <= nowIso) return Promise.resolve(null);
    this.resumeTokens.set(tokenHash, { ...t, usedAt: nowIso });
    return Promise.resolve(t.conversationId);
  }

  insights(sinceIso: string): Promise<InsightsRow> {
    const convs = [...this.conversations.values()].filter((c) => c.createdAt >= sinceIso);
    const msgs = [...this.messages.values()].filter((m) => m.createdAt >= sinceIso);
    const handed = new Set(
      [...this.handoffs.values()]
        .filter((h) => h.requestedAt >= sinceIso)
        .map((h) => h.conversationId),
    );
    const unhelpful = new Set(
      msgs.filter((m) => m.senderType === "ai" && m.feedback === -1).map((m) => m.conversationId),
    );
    const firstReplies = [...this.handoffs.values()]
      .filter((h) => h.requestedAt >= sinceIso)
      .map((h) => {
        const reply = [...this.messages.values()]
          .filter(
            (m) =>
              m.conversationId === h.conversationId &&
              m.senderType === "admin" &&
              m.createdAt >= h.requestedAt,
          )
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        return reply ? (Date.parse(reply.createdAt) - Date.parse(h.requestedAt)) / 1000 : null;
      })
      .filter((x): x is number => x !== null)
      .sort((a, b) => a - b);
    const median = firstReplies.length
      ? firstReplies.length % 2
        ? (firstReplies[(firstReplies.length - 1) / 2] as number)
        : ((firstReplies[firstReplies.length / 2 - 1] as number) +
            (firstReplies[firstReplies.length / 2] as number)) /
          2
      : null;
    const firsts = new Map<string, string>();
    for (const m of [...this.messages.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )) {
      if (
        m.senderType === "visitor" &&
        convs.some((c) => c.id === m.conversationId) &&
        !firsts.has(m.conversationId)
      ) {
        firsts.set(m.conversationId, (m.bodyRedacted ?? m.body).toLowerCase().slice(0, 120));
      }
    }
    const qCounts = new Map<string, number>();
    for (const q of firsts.values()) qCounts.set(q, (qCounts.get(q) ?? 0) + 1);
    const sinceDay = sinceIso.slice(0, 10);
    const usage = [...this.usage.values()].filter((u) => u.day >= sinceDay);
    return Promise.resolve({
      conversations: convs.length,
      handoffs: handed.size,
      aiResolved: convs.filter((c) => !handed.has(c.id) && !unhelpful.has(c.id)).length,
      helpful: msgs.filter((m) => m.senderType === "ai" && m.feedback === 1).length,
      notHelpful: msgs.filter((m) => m.senderType === "ai" && m.feedback === -1).length,
      medianFirstReplySeconds: median,
      waitingNow: [...this.conversations.values()].filter((c) => c.status === "awaiting_human")
        .length,
      topQuestions: [...qCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10)
        .map(([question, count]) => ({ question, count })),
      tokensIn: usage.reduce((s, u) => s + u.tokensIn, 0),
      tokensOut: usage.reduce((s, u) => s + u.tokensOut, 0),
      cacheHitTokens: usage.reduce((s, u) => s + u.cacheHitTokens, 0),
      estCostUsd: usage.reduce((s, u) => s + u.estCostUsd, 0),
    });
  }
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += (a[i] as number) * (b[i] as number);
  return s;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj))
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}
