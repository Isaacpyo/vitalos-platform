import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SenderType } from "../contract";
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
  UsageSource,
} from "./types";
import { USAGE_SOURCES } from "./types";

/**
 * Database failure. Carries only a SQLSTATE or fixed label, never the driver message: constraint
 * errors embed the failing row, which here can be personal data.
 */
export class RelayStoreError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`relay-store:${code}`);
    this.name = "RelayStoreError";
    this.code = code;
  }
}

type Row = Record<string, unknown>;

const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function camelRow<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}

function snakeRow(obj: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[toSnake(k)] = v;
  return out;
}

const vectorLiteral = (v: number[] | null) => (v ? `[${v.join(",")}]` : null);

/** Escapes LIKE wildcards so a search term is matched literally. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Unwraps a supabase-js result; the client is untyped, so data comes back as `unknown`. */
function check(result: { data: unknown; error: { code?: string } | null }): unknown {
  if (result.error) throw new RelayStoreError(result.error.code ?? "db_error");
  return result.data;
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapDocument(row: Row): KbDocumentRecord {
  const r = camelRow<KbDocumentRecord>(row);
  return {
    ...r,
    meta: (row.meta as KbDocumentRecord["meta"]) ?? {},
    adminMeta: (row.admin_meta as KbDocumentRecord["adminMeta"]) ?? {},
  };
}

function mapMessage(row: Row): MessageRecord {
  const r = camelRow<MessageRecord>(row);
  return {
    ...r,
    confidence: numberOrNull(row.confidence),
    feedback: (row.feedback as -1 | 1 | null) ?? null,
    feedbackReason: (row.feedback_reason as MessageRecord["feedbackReason"] | undefined) ?? null,
    meta: (row.meta as Record<string, unknown>) ?? {},
    citations: (row.citations as MessageRecord["citations"]) ?? [],
  };
}

function mapConversation(row: Row): ConversationRecord {
  const r = camelRow<ConversationRecord>(row);
  return {
    ...r,
    utm: (row.utm as Record<string, string>) ?? {},
    tags: (row.tags as string[]) ?? [],
    contactEmail: (row.contact_email as string | null) ?? null,
  };
}

function encodeCursor(ts: string, id: string): string {
  return Buffer.from(JSON.stringify([ts, id]), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): [string, string] | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (Array.isArray(value) && typeof value[0] === "string" && typeof value[1] === "string") {
      return [value[0], value[1]];
    }
  } catch {
    // fall through
  }
  return null;
}

export interface SupabaseStoreOptions {
  url: string;
  secretKey: string;
  fetch?: typeof fetch;
}

export class SupabaseRelayStore implements RelayStore {
  private readonly db;

  constructor(options: SupabaseStoreOptions) {
    const client = createClient(options.url, options.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      db: { schema: "relay" },
      ...(options.fetch ? { global: { fetch: options.fetch } } : {}),
    });
    this.db = client.schema("relay");
  }

  // -------------------------------------------------------------------------------------------
  async createConversation(input: NewConversation): Promise<ConversationRecord> {
    const row = check(
      await this.db
        .from("conversations")
        .insert(snakeRow({ ...input }))
        .select()
        .single(),
    );
    return mapConversation(row as Row);
  }

  async getConversation(id: string): Promise<ConversationRecord | null> {
    const row = check(await this.db.from("conversations").select().eq("id", id).maybeSingle());
    return row ? mapConversation(row as Row) : null;
  }

  async updateConversation(
    id: string,
    patch: ConversationPatch,
    expectStatus?: readonly ConversationRecord["status"][],
  ): Promise<ConversationRecord | null> {
    let query = this.db.from("conversations").update(snakeRow(patch)).eq("id", id);
    if (expectStatus && expectStatus.length > 0) query = query.in("status", [...expectStatus]);
    const row = check(await query.select().maybeSingle());
    return row ? mapConversation(row as Row) : null;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const rows = check(await this.db.from("conversations").delete().eq("id", id).select("id"));
    return Array.isArray(rows) && rows.length > 0;
  }

  async listInbox(
    params: InboxListParams,
  ): Promise<{ rows: InboxRow[]; nextCursor: string | null }> {
    const cursor = decodeCursor(params.cursor);
    const data = check(
      await this.db.rpc("inbox_list", {
        p_tab: params.tab,
        p_q: params.q ? escapeLike(params.q) : null,
        p_limit: params.limit + 1,
        p_cursor_ts: cursor?.[0] ?? null,
        p_cursor_id: cursor?.[1] ?? null,
      }),
    ) as Row[];
    const rows = data.slice(0, params.limit).map((r) => {
      const last = r.last_message as Row | null;
      return {
        conversation: mapConversation(r.conversation as Row),
        lastMessage: last
          ? {
              body: String(last.body),
              senderType: last.sender_type as SenderType,
              at: String(last.at),
            }
          : null,
        waitingSince: (r.waiting_since as string | null) ?? null,
        handoffTrigger: (r.handoff_trigger as InboxRow["handoffTrigger"]) ?? null,
      } satisfies InboxRow;
    });
    const lastRaw = data[params.limit - 1];
    const nextCursor =
      data.length > params.limit && lastRaw
        ? encodeCursor(String(lastRaw.sort_ts), String((lastRaw.conversation as Row).id))
        : null;
    return { rows, nextCursor };
  }

  async inboxCounts(): Promise<Record<InboxTab, number>> {
    const data = check(await this.db.rpc("inbox_counts")) as Record<InboxTab, number>;
    return {
      needs: Number(data.needs),
      live: Number(data.live),
      ai: Number(data.ai),
      closed: Number(data.closed),
    };
  }

  // -------------------------------------------------------------------------------------------
  async insertMessage(input: NewMessage): Promise<{ message: MessageRecord; duplicate: boolean }> {
    const result = await this.db
      .from("messages")
      .insert(snakeRow({ ...input }))
      .select()
      .single();
    if (result.error?.code === "23505" && input.clientMessageId) {
      const existing = check(
        await this.db
          .from("messages")
          .select()
          .eq("conversation_id", input.conversationId)
          .eq("client_message_id", input.clientMessageId)
          .single(),
      );
      return { message: mapMessage(existing as Row), duplicate: true };
    }
    return { message: mapMessage(check(result) as Row), duplicate: false };
  }

  async getMessage(id: string): Promise<MessageRecord | null> {
    const row = check(await this.db.from("messages").select().eq("id", id).maybeSingle());
    return row ? mapMessage(row as Row) : null;
  }

  async updateMessage(id: string, patch: MessagePatch): Promise<MessageRecord | null> {
    const row = check(
      await this.db.from("messages").update(snakeRow(patch)).eq("id", id).select().maybeSingle(),
    );
    return row ? mapMessage(row as Row) : null;
  }

  async listMessages(
    conversationId: string,
    opts: { after?: string; limit?: number } = {},
  ): Promise<MessageRecord[]> {
    let query = this.db.from("messages").select().eq("conversation_id", conversationId);
    if (opts.after) query = query.gt("created_at", opts.after);
    const rows = check(
      await query.order("created_at", { ascending: true }).limit(opts.limit ?? 500),
    );
    return (rows as Row[]).map(mapMessage);
  }

  // -------------------------------------------------------------------------------------------
  async createHandoff(input: {
    conversationId: string;
    trigger: HandoffRecord["trigger"];
    messageId: string | null;
  }): Promise<HandoffRecord> {
    const row = check(await this.db.from("handoffs").insert(snakeRow(input)).select().single());
    return camelRow<HandoffRecord>(row as Row);
  }

  async openHandoff(conversationId: string): Promise<HandoffRecord | null> {
    const row = check(
      await this.db
        .from("handoffs")
        .select()
        .eq("conversation_id", conversationId)
        .is("resolved_at", null)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    return row ? camelRow<HandoffRecord>(row as Row) : null;
  }

  async updateHandoff(
    id: string,
    patch: Partial<Omit<HandoffRecord, "id" | "conversationId">>,
  ): Promise<void> {
    check(await this.db.from("handoffs").update(snakeRow(patch)).eq("id", id));
  }

  async listOpenHandoffs(): Promise<HandoffRecord[]> {
    const rows = check(
      await this.db
        .from("handoffs")
        .select()
        .is("joined_at", null)
        .is("resolved_at", null)
        .order("requested_at")
        .limit(500),
    );
    return (rows as Row[]).map((r) => camelRow<HandoffRecord>(r));
  }

  // -------------------------------------------------------------------------------------------
  async upsertDocument(
    doc: UpsertKbDocument,
  ): Promise<{ document: KbDocumentRecord; changed: boolean; created: boolean }> {
    const existing = await this.getDocumentBySourceRef(doc.sourceRef);
    const byExternal =
      !existing && doc.externalId
        ? await this.getDocumentByExternalId(doc.source, doc.externalId)
        : null;
    const current = existing ?? byExternal;
    if (!current) {
      const row = check(
        await this.db
          .from("kb_documents")
          .insert(snakeRow({ ...doc }))
          .select()
          .single(),
      );
      return { document: mapDocument(row as Row), changed: true, created: true };
    }
    const changed =
      current.checksum !== doc.checksum ||
      current.status !== doc.status ||
      current.sourceRef !== doc.sourceRef ||
      JSON.stringify(current.adminMeta) !== JSON.stringify(doc.adminMeta) ||
      JSON.stringify(current.meta) !== JSON.stringify(doc.meta);
    if (!changed) return { document: current, changed: false, created: false };
    const row = check(
      await this.db
        .from("kb_documents")
        .update(snakeRow({ ...doc }))
        .eq("id", current.id)
        .select()
        .single(),
    );
    return {
      document: mapDocument(row as Row),
      changed: current.checksum !== doc.checksum,
      created: false,
    };
  }

  async replaceChunks(documentId: string, chunks: KbChunkInput[]): Promise<void> {
    check(await this.db.from("kb_chunks").delete().eq("document_id", documentId));
    if (chunks.length === 0) return;
    check(
      await this.db.from("kb_chunks").insert(
        chunks.map((c) => ({
          document_id: documentId,
          ix: c.ix,
          heading: c.heading,
          content: c.content,
          token_count: c.tokenCount,
          embedding: vectorLiteral(c.embedding),
        })),
      ),
    );
  }

  async getDocument(id: string): Promise<KbDocumentRecord | null> {
    const row = check(await this.db.from("kb_documents").select().eq("id", id).maybeSingle());
    return row ? mapDocument(row as Row) : null;
  }

  async getDocumentBySourceRef(sourceRef: string): Promise<KbDocumentRecord | null> {
    const row = check(
      await this.db.from("kb_documents").select().eq("source_ref", sourceRef).maybeSingle(),
    );
    return row ? mapDocument(row as Row) : null;
  }

  async getDocumentByExternalId(
    source: KbSource,
    externalId: string,
  ): Promise<KbDocumentRecord | null> {
    const row = check(
      await this.db
        .from("kb_documents")
        .select()
        .eq("source", source)
        .eq("external_id", externalId)
        .maybeSingle(),
    );
    return row ? mapDocument(row as Row) : null;
  }

  async listDocuments(filter: KbDocumentFilter): Promise<KbDocumentListItem[]> {
    let query = this.db
      .from("kb_documents")
      .select(
        "id, source, source_ref, external_id, title, url, type, checksum, status, owner, review_date, updated_by, meta, created_at, updated_at, kb_chunks(count)",
      );
    if (filter.source) query = query.eq("source", filter.source);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.section) query = query.eq("meta->>section", filter.section);
    if (filter.q) query = query.ilike("title", `%${escapeLike(filter.q)}%`);
    const rows = check(await query.order("updated_at", { ascending: false }).limit(1000)) as Row[];
    return rows.map((r) => {
      const counts = r.kb_chunks as { count: number }[] | undefined;
      const { kb_chunks: _ignored, ...rest } = r;
      void _ignored;
      return {
        ...camelRow<Omit<KbDocumentListItem, "chunks">>(rest),
        meta: (r.meta as KbDocumentListItem["meta"]) ?? {},
        chunks: counts?.[0]?.count ?? 0,
      };
    });
  }

  async setDocumentStatus(
    id: string,
    status: KbStatus,
    updatedBy: string | null,
  ): Promise<KbDocumentRecord | null> {
    const row = check(
      await this.db
        .from("kb_documents")
        .update({ status, updated_by: updatedBy })
        .eq("id", id)
        .select()
        .maybeSingle(),
    );
    return row ? mapDocument(row as Row) : null;
  }

  async listSourceRefs(
    source: KbSource,
  ): Promise<{ id: string; sourceRef: string; status: KbStatus }[]> {
    const rows = check(
      await this.db
        .from("kb_documents")
        .select("id, source_ref, status")
        .eq("source", source)
        .limit(5000),
    );
    return (rows as Row[]).map((r) => ({
      id: String(r.id),
      sourceRef: String(r.source_ref),
      status: r.status as KbStatus,
    }));
  }

  async matchChunks(params: MatchParams): Promise<MatchedChunk[]> {
    const rows = check(
      await this.db.rpc("match_chunks", {
        query_text: params.queryText,
        query_embedding: vectorLiteral(params.embedding),
        match_count: params.matchCount,
        rrf_k: params.rrfK ?? 50,
        page_path: params.pagePath ?? null,
        page_bonus: params.pageBonus ?? 0.25,
      }),
    ) as Row[];
    return rows.map((r) => ({
      chunkId: String(r.chunk_id),
      documentId: String(r.document_id),
      title: String(r.title),
      url: (r.url as string | null) ?? null,
      type: r.type as MatchedChunk["type"],
      source: r.source as KbSource,
      externalId: (r.external_id as string | null) ?? null,
      heading: typeof r.heading === "string" ? r.heading : "",
      content: String(r.content),
      meta: (r.meta as MatchedChunk["meta"]) ?? {},
      rrfScore: Number(r.rrf_score),
      similarity: numberOrNull(r.similarity),
      ftsRank: numberOrNull(r.fts_rank),
    }));
  }

  private vocabulary: { at: number; words: ReadonlyMap<string, number> } | null = null;

  /**
   * `relay.kb_vocabulary()` (one jsonb object, so no row limit applies), cached for ten minutes
   * per server instance. A missing function (migration not yet applied) or an error disables typo
   * tolerance rather than failing the answer.
   */
  async kbVocabulary(): Promise<ReadonlyMap<string, number>> {
    const now = Date.now();
    if (this.vocabulary && now - this.vocabulary.at < 600_000) return this.vocabulary.words;
    let words: ReadonlyMap<string, number>;
    try {
      const data = check(await this.db.rpc("kb_vocabulary")) as Record<string, number> | null;
      words = new Map(Object.entries(data ?? {}).map(([w, n]) => [w, Number(n)]));
    } catch {
      words = new Map();
    }
    this.vocabulary = { at: now, words };
    return words;
  }

  async faqQuestionsForPage(pagePath: string, limit: number) {
    const rows = check(
      await this.db
        .from("kb_documents")
        .select("title, meta")
        .eq("source", "faq")
        .eq("status", "published")
        .filter("meta->page_placements", "cs", JSON.stringify([pagePath]))
        .limit(200),
    ) as Row[];
    return rows
      .map((r) => {
        const meta = (r.meta as KbDocumentRecord["meta"]) ?? {};
        return {
          question: String(r.title),
          placements: meta.page_placements ?? [],
          sectionOrder: meta.section_order ?? 99,
        };
      })
      .slice(0, Math.max(limit * 10, limit));
  }

  async listChunksForDocument(documentId: string) {
    const rows = check(
      await this.db
        .from("kb_chunks")
        .select("ix, heading, content, embedding")
        .eq("document_id", documentId)
        .order("ix"),
    ) as Row[];
    return rows.map((r) => ({
      ix: Number(r.ix),
      heading: String(r.heading),
      content: String(r.content),
      hasEmbedding: r.embedding !== null,
    }));
  }

  async listAdminMetaForSource(source: KbSource) {
    const rows = check(
      await this.db
        .from("kb_documents")
        .select("id, external_id, title, status, meta, admin_meta")
        .eq("source", source)
        .limit(5000),
    ) as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      externalId: (r.external_id as string | null) ?? null,
      title: String(r.title),
      status: r.status as KbStatus,
      meta: (r.meta as KbDocumentRecord["meta"]) ?? {},
      adminMeta: (r.admin_meta as KbDocumentRecord["adminMeta"]) ?? {},
    }));
  }

  // -------------------------------------------------------------------------------------------
  async recordGap(
    questionNorm: string,
    example: string,
    conversationId: string | null,
  ): Promise<void> {
    check(
      await this.db.rpc("record_gap", {
        p_question_norm: questionNorm,
        p_example: example,
        p_conversation_id: conversationId,
      }),
    );
  }

  async listGaps(sinceIso: string): Promise<GapRecord[]> {
    const rows = check(
      await this.db
        .from("kb_gaps")
        .select()
        .gte("last_asked_at", sinceIso)
        .eq("status", "open")
        .order("count", { ascending: false })
        .limit(200),
    );
    return (rows as Row[]).map((r) => camelRow<GapRecord>(r));
  }

  async setGapStatus(id: string, status: GapRecord["status"]): Promise<void> {
    check(await this.db.from("kb_gaps").update({ status }).eq("id", id));
  }

  async startSyncRun(source: KbSource, mode: SyncRunRecord["mode"]): Promise<SyncRunRecord> {
    const row = check(
      await this.db.from("kb_sync_runs").insert({ source, mode }).select().single(),
    );
    return camelRow<SyncRunRecord>(row as Row);
  }

  async finishSyncRun(run: SyncRunRecord): Promise<void> {
    check(
      await this.db
        .from("kb_sync_runs")
        .update(
          snakeRow({
            finishedAt: run.finishedAt ?? new Date().toISOString(),
            added: run.added,
            updated: run.updated,
            archived: run.archived,
            held: run.held,
            skippedUnverified: run.skippedUnverified,
            errors: run.errors,
          }),
        )
        .eq("id", run.id),
    );
  }

  async lastSyncRuns(source: KbSource, limit: number): Promise<SyncRunRecord[]> {
    const rows = check(
      await this.db
        .from("kb_sync_runs")
        .select()
        .eq("source", source)
        .order("started_at", { ascending: false })
        .limit(limit),
    );
    return (rows as Row[]).map((r) => camelRow<SyncRunRecord>(r));
  }

  // -------------------------------------------------------------------------------------------
  async heartbeat(
    admin: { adminId: string; name: string; initials: string },
    available?: boolean,
  ): Promise<PresenceRecord> {
    const row = check(
      await this.db
        .from("admin_presence")
        .upsert(
          snakeRow({
            ...admin,
            lastSeenAt: new Date().toISOString(),
            ...(available === undefined ? {} : { available }),
          }),
          { onConflict: "admin_id" },
        )
        .select()
        .single(),
    );
    return camelRow<PresenceRecord>(row as Row);
  }

  async listPresence(): Promise<PresenceRecord[]> {
    const rows = check(
      await this.db.from("admin_presence").select().order("last_seen_at", { ascending: false }),
    );
    return (rows as Row[]).map((r) => camelRow<PresenceRecord>(r));
  }

  async getSettingsConfig(): Promise<unknown> {
    const row = check(
      await this.db.from("settings").select("config").eq("id", 1).maybeSingle(),
    ) as Row | null;
    return row?.config ?? {};
  }

  async putSettingsConfig(config: unknown, updatedBy: string | null): Promise<void> {
    check(await this.db.from("settings").update({ config, updated_by: updatedBy }).eq("id", 1));
  }

  async addUsage(
    day: string,
    tokensIn: number,
    tokensOut: number,
    cacheHit: number,
    costUsd: number,
    source: UsageSource = "chat",
  ): Promise<UsageRecord> {
    const args = {
      p_day: day,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
      p_cache_hit: cacheHit,
      p_cost: costUsd,
    };
    // add_usage_tagged (20261017090000_relay_review.sql) also counts by source. Until that
    // migration is applied the call falls back to the untagged counter, so the cap keeps working.
    const tagged = await this.db.rpc("add_usage_tagged", { ...args, p_source: source });
    if (!tagged.error) return this.mapUsage(tagged.data as Row);
    const row = check(await this.db.rpc("add_usage", args)) as Row;
    return this.mapUsage(row);
  }

  async getUsage(day: string): Promise<UsageRecord | null> {
    const row = check(await this.db.from("usage_daily").select().eq("day", day).maybeSingle());
    return row ? this.mapUsage(row as Row) : null;
  }

  async markCapNotified(day: string): Promise<boolean> {
    const rows = check(
      await this.db
        .from("usage_daily")
        .update({ cap_notified_at: new Date().toISOString() })
        .eq("day", day)
        .is("cap_notified_at", null)
        .select("day"),
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  async hitRateLimit(key: string, windowSeconds: number, max: number): Promise<boolean> {
    return Boolean(
      check(
        await this.db.rpc("hit_rate_limit", { key, window_seconds: windowSeconds, max_count: max }),
      ),
    );
  }

  async audit(entry: {
    actorAdminId: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    check(await this.db.from("audit_log").insert(snakeRow({ ...entry, meta: entry.meta ?? {} })));
  }

  async insertEmail(
    email: Omit<EmailOutboxRecord, "id" | "createdAt">,
  ): Promise<EmailOutboxRecord> {
    const row = check(
      await this.db
        .from("email_outbox")
        .insert(snakeRow({ ...email }))
        .select()
        .single(),
    );
    return camelRow<EmailOutboxRecord>(row as Row);
  }

  async listEmails(limit: number): Promise<EmailOutboxRecord[]> {
    const rows = check(
      await this.db
        .from("email_outbox")
        .select(
          "id, to, subject, provider, status, provider_message_id, conversation_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
    );
    return (rows as Row[]).map((r) => ({ ...camelRow<EmailOutboxRecord>(r), html: "", text: "" }));
  }

  async insertResumeToken(
    tokenHash: string,
    conversationId: string,
    expiresAt: string,
  ): Promise<void> {
    check(
      await this.db
        .from("resume_tokens")
        .insert({ token_hash: tokenHash, conversation_id: conversationId, expires_at: expiresAt }),
    );
  }

  async consumeResumeToken(tokenHash: string, nowIso: string): Promise<string | null> {
    const rows = check(
      await this.db
        .from("resume_tokens")
        .update({ used_at: nowIso })
        .eq("token_hash", tokenHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .select("conversation_id"),
    ) as Row[];
    return rows[0] ? String(rows[0].conversation_id) : null;
  }

  async insights(sinceIso: string): Promise<InsightsRow> {
    const data = check(await this.db.rpc("insights", { p_since: sinceIso })) as Row;
    return {
      conversations: Number(data.conversations),
      aiResolved: Number(data.aiResolved),
      handoffs: Number(data.handoffs),
      helpful: Number(data.helpful),
      notHelpful: Number(data.notHelpful),
      medianFirstReplySeconds: numberOrNull(data.medianFirstReplySeconds),
      waitingNow: Number(data.waitingNow),
      topQuestions: (data.topQuestions as { question: string; count: number }[]).map((t) => ({
        question: t.question,
        count: Number(t.count),
      })),
      tokensIn: Number(data.tokensIn),
      tokensOut: Number(data.tokensOut),
      cacheHitTokens: Number(data.cacheHitTokens),
      estCostUsd: Number(data.estCostUsd),
      // Added by 20261017090000_relay_review.sql; zero until that migration is applied.
      usageBySource: Object.fromEntries(
        [...USAGE_SOURCES, "untagged" as const].map((s) => {
          const v = ((data.usageBySource as Row | undefined)?.[s] as Row | undefined) ?? {};
          return [
            s,
            {
              tokensIn: Number(v.tokensIn ?? 0),
              tokensOut: Number(v.tokensOut ?? 0),
              requests: Number(v.requests ?? 0),
            },
          ];
        }),
      ) as InsightsRow["usageBySource"],
      turns: {
        count: Number((data.turns as Row | undefined)?.count ?? 0),
        tokensIn: Number((data.turns as Row | undefined)?.tokensIn ?? 0),
        avgTokensIn: Math.round(Number((data.turns as Row | undefined)?.avgTokensIn ?? 0)),
        p95TokensIn: Math.round(Number((data.turns as Row | undefined)?.p95TokensIn ?? 0)),
        maxTokensIn: Number((data.turns as Row | undefined)?.maxTokensIn ?? 0),
      },
      feedbackReasons: {
        wrong: Number((data.feedbackReasons as Row | undefined)?.wrong ?? 0),
        incomplete: Number((data.feedbackReasons as Row | undefined)?.incomplete ?? 0),
        didnt_understand: Number((data.feedbackReasons as Row | undefined)?.didnt_understand ?? 0),
      },
    };
  }

  private mapUsage(row: Row): UsageRecord {
    return {
      day: String(row.day),
      requests: Number(row.requests),
      tokensIn: Number(row.tokens_in),
      tokensOut: Number(row.tokens_out),
      cacheHitTokens: Number(row.cache_hit_tokens),
      estCostUsd: Number(row.est_cost_usd),
      capNotifiedAt: (row.cap_notified_at as string | null) ?? null,
    };
  }
}
