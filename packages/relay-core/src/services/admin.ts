import type {
  ConversationRecord,
  InboxTab,
  KbDocumentRecord,
  KbSource,
  MessageRecord,
} from "../db/types";
import { normaliseQuestion } from "../handoff/intent";
import { ingestEntries } from "../knowledge/ingest";
import type { IngestResult } from "../knowledge/ingest";
import type { KnowledgeEntry } from "../knowledge/types";
import { checksumOf } from "../knowledge/checksum";
import { publicCitations } from "../llm/citations";
import { redact } from "../redact/redact";
import { retrieve } from "../retrieval/search";
import type { AdminIdentity, knowledgeDraftBody } from "../schemas/api";
import { parseStoredSettings, relaySettingsSchema } from "../schemas/settings";
import type { RelaySettings } from "../schemas/settings";
import { teamStatus as computeTeamStatus } from "../util/team";
import { firstName, initialsOf, sha256Hex, visitorLabel } from "../util/tokens";
import type { RelayContext } from "./context";
import { RelayError } from "./context";
import type { z } from "zod";

/** Supplied by the app: bundled knowledge (repo seed, website content, FAQ snapshot). */
export type BundledEntriesLoader = (options: {
  includeFaqSnapshot: boolean;
}) => Promise<KnowledgeEntry[]>;

export interface FaqSyncPort {
  /** Live Notion sync when configured, else the committed snapshot. */
  sync(options: { full: boolean; actor: string }): Promise<FaqRunSummary>;
  status(): Promise<FaqStatus>;
}

export interface FaqRunSummary {
  mode: "incremental" | "full" | "snapshot";
  added: number;
  updated: number;
  archived: number;
  held: number;
  skippedUnverified: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

export interface FaqStatus {
  mode: "notion" | "snapshot";
  hubActive: boolean | null;
  needsConfirmation: {
    externalId: string;
    question: string | null;
    section: string;
    confirmNote: string | null;
    notionUrl: string | null;
  }[];
  held: {
    externalId: string;
    question: string | null;
    reasons: string[];
    notionUrl: string | null;
  }[];
  lastRun: (FaqRunSummary & { id?: string }) | null;
}

const TAB_LIMIT = 50;

function pagePathOf(c: ConversationRecord): string | null {
  if (!c.pageUrl || !URL.canParse(c.pageUrl)) return null;
  return new URL(c.pageUrl).pathname;
}

function conversationRow(row: {
  conversation: ConversationRecord;
  lastMessage: { body: string; senderType: string; at: string } | null;
  waitingSince: string | null;
}) {
  const c = row.conversation;
  return {
    id: c.id,
    status: c.status,
    displayName: c.contactName ?? visitorLabel(c.id),
    contactName: c.contactName,
    lastMessage: row.lastMessage
      ? {
          body: row.lastMessage.body.slice(0, 140),
          senderType: row.lastMessage.senderType,
          at: row.lastMessage.at,
        }
      : null,
    waitingSince: c.status === "awaiting_human" ? row.waitingSince : null,
    assigned: c.assignedAdminId
      ? {
          id: c.assignedAdminId,
          name: c.assignedAdminName ?? "",
          initials: c.assignedAdminInitials ?? "",
        }
      : null,
    tags: c.tags,
    pagePath: pagePathOf(c),
    lastMessageAt: c.lastMessageAt,
    aiTurns: c.aiTurns,
  };
}

export function adminMessage(m: MessageRecord) {
  return {
    id: m.id,
    senderType: m.senderType,
    body: m.body,
    adminName: m.adminName,
    adminInitials: m.adminInitials,
    citations: publicCitations(m.citations),
    confidence: m.confidence,
    feedback: m.feedback,
    latencyMs: m.latencyMs,
    handoffSuggested: m.handoffSuggested,
    truncated: m.truncated,
    meta: m.senderType === "system" ? pickSystemMeta(m.meta) : {},
    createdAt: m.createdAt,
  };
}

function pickSystemMeta(meta: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ["trigger", "consent", "name", "by", "outOfHours"] as const)
    if (meta[k] !== undefined) out[k] = meta[k];
  return out;
}

/** Admin-facing operations behind the signed admin API (docs/relay/API.md). */
export class AdminService {
  constructor(
    private readonly ctx: RelayContext,
    private readonly ports: { bundledEntries: BundledEntriesLoader; faq: FaqSyncPort },
  ) {}

  private get store() {
    return this.ctx.deps.store;
  }
  private now() {
    return this.ctx.deps.now();
  }

  async settings(): Promise<RelaySettings> {
    return parseStoredSettings(await this.store.getSettingsConfig());
  }

  private async require(id: string): Promise<ConversationRecord> {
    const c = await this.store.getConversation(id);
    if (!c) throw new RelayError("not_found");
    return c;
  }

  private pingVisitor(c: ConversationRecord) {
    this.ctx.deps.defer(() => this.ctx.deps.broadcaster.visitor(c.channelKey, "changed"));
  }

  private pingAdmins(conversationId?: string) {
    this.ctx.deps.defer(() =>
      this.ctx.deps.broadcaster.admins("inbox_changed", conversationId ? { conversationId } : {}),
    );
  }

  // -------------------------------------------------------------------------------------------
  async inbox(tab: InboxTab, q: string | undefined, cursor: string | undefined) {
    const [counts, page] = await Promise.all([
      this.store.inboxCounts(),
      this.store.listInbox({ tab, q, cursor, limit: TAB_LIMIT }),
    ]);
    const realtime = this.ctx.config.realtime;
    return {
      counts,
      items: page.rows.map(conversationRow),
      nextCursor: page.nextCursor,
      realtime: realtime
        ? { url: realtime.url, key: realtime.publicKey, channel: realtime.adminTopic }
        : null,
    };
  }

  async conversation(id: string) {
    const c = await this.require(id);
    await this.store.updateConversation(id, { adminLastReadAt: this.now().toISOString() });
    const [messages, handoff] = await Promise.all([
      this.store.listMessages(id),
      this.store.openHandoff(id),
    ]);
    const lastHandoff = handoff ?? null;
    return {
      conversation: {
        id: c.id,
        status: c.status,
        displayName: c.contactName ?? visitorLabel(c.id),
        contact: c.contactEmail
          ? {
              name: c.contactName,
              email: c.contactEmail,
              company: c.contactCompany,
              consentAt: c.consentAt,
              noticeVersion: c.consentNoticeVersion,
            }
          : null,
        session: {
          pageUrl: c.pageUrl,
          pageTitle: c.pageTitle,
          referrer: c.referrer,
          device: c.device,
          country: c.country,
          startedAt: c.createdAt,
          messageCount: messages.filter(
            (m) => m.senderType === "visitor" || m.senderType === "ai" || m.senderType === "admin",
          ).length,
        },
        summary: c.summary,
        summaryMeta: c.summaryMeta,
        assigned: c.assignedAdminId
          ? {
              id: c.assignedAdminId,
              name: c.assignedAdminName ?? "",
              initials: c.assignedAdminInitials ?? "",
            }
          : null,
        handoff: lastHandoff
          ? {
              trigger: lastHandoff.trigger,
              requestedAt: lastHandoff.requestedAt,
              reminderCount: lastHandoff.reminderCount,
            }
          : null,
        firstAdminJoinedAt: c.firstAdminJoinedAt,
        visitorLastSeenAt: c.lastVisitorSeenAt,
        closedAt: c.closedAt,
        tags: c.tags,
      },
      messages: messages.map(adminMessage),
      visitorTyping: false,
    };
  }

  async messagesAfter(id: string, after: string | undefined) {
    const c = await this.require(id);
    const messages = await this.store.listMessages(id, after ? { after } : {});
    return {
      messages: messages.map(adminMessage),
      status: c.status,
      assigned: c.assignedAdminId
        ? {
            id: c.assignedAdminId,
            name: c.assignedAdminName ?? "",
            initials: c.assignedAdminInitials ?? "",
          }
        : null,
      visitorTyping: false,
    };
  }

  private publicConversation(c: ConversationRecord) {
    return {
      id: c.id,
      status: c.status,
      assigned: c.assignedAdminId
        ? {
            id: c.assignedAdminId,
            name: c.assignedAdminName ?? "",
            initials: c.assignedAdminInitials ?? "",
          }
        : null,
      firstAdminJoinedAt: c.firstAdminJoinedAt,
      closedAt: c.closedAt,
    };
  }

  /** Join: a person takes over and Relay AI pauses for this conversation. */
  async join(id: string, admin: AdminIdentity) {
    const c = await this.require(id);
    if (c.status === "closed")
      throw new RelayError("conversation_closed", "This conversation is closed.");
    if (c.status === "human" && c.assignedAdminId)
      return { conversation: this.publicConversation(c) };
    const now = this.now().toISOString();
    const updated = await this.store.updateConversation(
      id,
      {
        status: "human",
        assignedAdminId: admin.id,
        assignedAdminName: admin.name,
        assignedAdminInitials: admin.initials || initialsOf(admin.name),
        firstAdminJoinedAt: c.firstAdminJoinedAt ?? now,
      },
      ["ai", "awaiting_human", "human"],
    );
    if (!updated) throw new RelayError("conversation_closed", "This conversation is closed.");
    const open = await this.store.openHandoff(id);
    if (open && !open.joinedAt)
      await this.store.updateHandoff(open.id, { joinedBy: admin.id, joinedAt: now });
    await this.store.insertMessage({
      conversationId: id,
      senderType: "system",
      body: "admin_joined",
      meta: { name: admin.name },
    });
    await this.store.insertMessage({
      conversationId: id,
      senderType: "system",
      body: "ai_paused",
      meta: {},
    });
    this.pingVisitor(updated);
    this.pingAdmins(id);
    return { conversation: this.publicConversation(updated) };
  }

  async assign(id: string, target: { id: string; name: string; initials: string }) {
    await this.require(id);
    const updated = await this.store.updateConversation(id, {
      assignedAdminId: target.id,
      assignedAdminName: target.name,
      assignedAdminInitials: target.initials || initialsOf(target.name),
    });
    if (!updated) throw new RelayError("not_found");
    this.pingAdmins(id);
    return { conversation: this.publicConversation(updated) };
  }

  /** Hand back to Relay: AI resumes; the hand-off is resolved. */
  async handback(id: string) {
    const c = await this.require(id);
    if (c.status === "closed")
      throw new RelayError("conversation_closed", "This conversation is closed.");
    const updated = await this.store.updateConversation(id, { status: "ai" }, [
      "human",
      "awaiting_human",
    ]);
    if (!updated) return { conversation: this.publicConversation(c) };
    const open = await this.store.openHandoff(id);
    if (open) await this.store.updateHandoff(open.id, { resolvedAt: this.now().toISOString() });
    await this.store.insertMessage({
      conversationId: id,
      senderType: "system",
      body: "ai_back",
      meta: {},
    });
    this.pingVisitor(updated);
    this.pingAdmins(id);
    return { conversation: this.publicConversation(updated) };
  }

  async close(id: string, admin: AdminIdentity) {
    const c = await this.require(id);
    if (c.status === "closed") return { conversation: this.publicConversation(c) };
    const now = this.now().toISOString();
    const updated = await this.store.updateConversation(id, {
      status: "closed",
      closedAt: now,
      closedReason: "admin_closed",
    });
    if (!updated) throw new RelayError("not_found");
    const open = await this.store.openHandoff(id);
    if (open) await this.store.updateHandoff(open.id, { resolvedAt: now });
    await this.store.insertMessage({
      conversationId: id,
      senderType: "system",
      body: "closed",
      meta: { by: "admin", name: admin.name },
    });
    this.pingVisitor(updated);
    this.pingAdmins(id);
    return { conversation: this.publicConversation(updated) };
  }

  async reply(
    id: string,
    admin: AdminIdentity,
    input: { text: string; clientMessageId: string; emailIfAway: boolean },
  ) {
    let c = await this.require(id);
    if (c.status === "closed")
      throw new RelayError("conversation_closed", "This conversation is closed.");
    if (c.status !== "human") {
      await this.join(id, admin);
      c = await this.require(id);
    }
    const { message, duplicate } = await this.store.insertMessage({
      conversationId: id,
      senderType: "admin",
      adminId: admin.id,
      adminName: admin.name,
      adminInitials: admin.initials || initialsOf(admin.name),
      body: input.text,
      clientMessageId: input.clientMessageId,
    });
    const updated =
      (await this.store.updateConversation(id, { lastMessageAt: this.now().toISOString() })) ?? c;
    let emailed = false;
    if (!duplicate) {
      this.pingVisitor(updated);
      this.pingAdmins(id);
      if (input.emailIfAway) emailed = await this.emailVisitorIfAway(updated, admin, input.text);
    }
    return {
      message: adminMessage(message),
      emailed,
      conversation: this.publicConversation(updated),
    };
  }

  /**
   * Emails the reply when visitor emails are enabled (env and Settings), the visitor gave email and
   * consent, and has not been seen for two minutes (section 7.4). Includes a single-use resume link.
   */
  private async emailVisitorIfAway(
    c: ConversationRecord,
    admin: AdminIdentity,
    text: string,
  ): Promise<boolean> {
    const settings = await this.settings();
    if (!this.ctx.config.visitorEmailsEnabled || !settings.visitorEmailsEnabled) return false;
    if (!c.contactEmail || !c.consentAt) return false;
    const lastSeen = c.lastVisitorSeenAt ? Date.parse(c.lastVisitorSeenAt) : 0;
    if (this.now().getTime() - lastSeen < 2 * 60 * 1000) return false;
    const { visitorReplyEmail, createResumeToken } = await import("./visitor-email");
    const token = await createResumeToken(this.ctx, c.id);
    const email = visitorReplyEmail({
      visitorName: c.contactName ?? "",
      adminName: admin.name,
      reply: text,
      resumeUrl: `${this.ctx.config.publicSiteUrl}/?relay=resume&t=${encodeURIComponent(token)}`,
      privacyUrl: this.ctx.config.privacyUrl,
    });
    const status = await this.ctx.deps.mailer.send({
      to: c.contactEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      conversationId: c.id,
      inlineImages: email.inlineImages,
    });
    // Only a provider-accepted send counts: "logged" means nothing left this server.
    return status === "sent";
  }

  async note(id: string, admin: AdminIdentity, text: string) {
    await this.require(id);
    const { message } = await this.store.insertMessage({
      conversationId: id,
      senderType: "note",
      adminId: admin.id,
      adminName: admin.name,
      adminInitials: admin.initials || initialsOf(admin.name),
      body: text,
    });
    this.pingAdmins(id);
    return { message: adminMessage(message) };
  }

  async typing(id: string, admin: AdminIdentity) {
    const c = await this.require(id);
    if (!(await this.store.hitRateLimit(`atyping:${id}`, 10, 5))) return {};
    await this.ctx.deps.broadcaster.visitor(c.channelKey, "typing", {
      name: firstName(admin.name),
    });
    return {};
  }

  async remove(id: string, admin: AdminIdentity) {
    await this.require(id);
    await this.store.deleteConversation(id);
    await this.store.audit({
      actorAdminId: admin.id,
      action: "conversation.deleted_by_admin",
      targetType: "conversation",
      targetId: sha256Hex(id).slice(0, 32),
    });
    this.pingAdmins();
    return {};
  }

  /** Draft team answer from the visitor's question (redacted) and the admin's reply. */
  async saveToKnowledge(id: string, messageId: string, admin: AdminIdentity) {
    await this.require(id);
    const messages = await this.store.listMessages(id);
    const reply = messages.find((m) => m.id === messageId);
    if (!reply || reply.senderType !== "admin")
      throw new RelayError("invalid", "Choose a reply from the team.");
    const question = [...messages]
      .filter((m) => m.senderType === "visitor" && m.createdAt <= reply.createdAt)
      .at(-1);
    const title = (question ? (question.bodyRedacted ?? redact(question.body)) : "Team answer")
      .replace(/\s+/g, " ")
      .slice(0, 200);
    const body = redact(reply.body);
    const ref = `team:${sha256Hex(`${id}:${messageId}`).slice(0, 24)}`;
    const { document } = await this.store.upsertDocument({
      source: "team_answer",
      sourceRef: ref,
      externalId: null,
      title,
      url: null,
      type: "faq",
      bodyMd: body,
      checksum: checksumOf({ title, body }),
      status: "draft",
      owner: admin.name,
      reviewDate: null,
      updatedBy: admin.name,
      meta: {},
      adminMeta: {},
    });
    if (question) {
      const norm = normaliseQuestion(question.bodyRedacted ?? redact(question.body));
      const gap = (await this.store.listGaps(new Date(0).toISOString())).find(
        (g) => g.questionNorm === norm,
      );
      if (gap) await this.store.setGapStatus(gap.id, "answered");
    }
    return { documentId: document.id };
  }

  async transcript(id: string) {
    const c = await this.require(id);
    const messages = await this.store.listMessages(id);
    const time = (iso: string) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    const label = (m: MessageRecord) =>
      m.senderType === "visitor"
        ? (c.contactName ?? "Visitor")
        : m.senderType === "ai"
          ? "Relay (AI)"
          : m.senderType === "admin"
            ? `${m.adminName ?? "Vitalos"} (Vitalos)`
            : "System";
    const lines = messages
      .filter((m) => m.senderType !== "note")
      .map(
        (m) =>
          `[${time(m.createdAt)}] ${label(m)}: ${m.senderType === "system" ? m.body.replace(/_/g, " ") : m.body}`,
      );
    return { text: [`Relay conversation ${visitorLabel(c.id)}`, ...lines].join("\n") };
  }

  // -------------------------------------------------------------------------------------------
  async presence(admin: AdminIdentity, available: boolean | undefined) {
    await this.store.heartbeat(
      { adminId: admin.id, name: admin.name, initials: admin.initials || initialsOf(admin.name) },
      available,
    );
    const settings = await this.settings();
    return { teamStatus: computeTeamStatus(await this.store.listPresence(), settings, this.now()) };
  }

  async presenceList() {
    const settings = await this.settings();
    const list = await this.store.listPresence();
    return {
      admins: list.map((p) => ({
        id: p.adminId,
        name: p.name,
        available: p.available,
        lastSeenAt: p.lastSeenAt,
      })),
      teamStatus: computeTeamStatus(list, settings, this.now()),
    };
  }

  // -------------------------------------------------------------------------------------------
  private readOnly(d: { source: KbSource }) {
    return d.source !== "team_answer";
  }

  async knowledgeList(filter: {
    source?: KbSource;
    status?: "draft" | "published" | "archived";
    section?: string;
    q?: string;
  }) {
    const [items, faq] = await Promise.all([
      this.store.listDocuments(filter),
      this.ports.faq.status(),
    ]);
    const all =
      filter.source || filter.status || filter.section || filter.q
        ? await this.store.listDocuments({})
        : items;
    const stat = (source: KbSource) => {
      const docs = all.filter((d) => d.source === source);
      const syncedAt = docs.reduce<string | null>(
        (max, d) => (!max || d.updatedAt > max ? d.updatedAt : max),
        null,
      );
      return { count: docs.filter((d) => d.status === "published").length, syncedAt };
    };
    const faqDocs = all.filter((d) => d.source === "faq");
    return {
      sources: {
        cms: stat("cms"),
        repo: stat("repo"),
        team_answer: stat("team_answer"),
        faq: {
          verified: faqDocs.filter(
            (d) => d.status !== "archived" && d.meta.faq_status === "Verified",
          ).length,
          live: faqDocs.filter((d) => d.status === "published").length,
          awaiting: faq.needsConfirmation.length,
          held: faq.held.length,
          syncedAt: faq.lastRun?.finishedAt ?? stat("faq").syncedAt,
          mode: faq.mode,
        },
      },
      items: items.map((d) => ({
        id: d.id,
        source: d.source,
        title: d.title,
        type: d.type,
        status: d.status,
        chunks: d.chunks,
        updatedAt: d.updatedAt,
        url: d.url,
        externalId: d.source === "faq" ? d.externalId : null,
        section: d.meta.section ?? null,
        readOnly: this.readOnly(d),
        notionUrl: d.meta.notion_url ?? null,
      })),
    };
  }

  async knowledgeGet(id: string) {
    const d = await this.store.getDocument(id);
    if (!d) throw new RelayError("not_found");
    const chunks = await this.store.listChunksForDocument(id);
    return { document: this.documentView(d, chunks.length) };
  }

  private documentView(d: KbDocumentRecord, chunks: number) {
    return {
      id: d.id,
      source: d.source,
      title: d.title,
      url: d.url,
      type: d.type,
      owner: d.owner,
      reviewDate: d.reviewDate,
      bodyMd: d.bodyMd,
      status: d.status,
      meta: d.meta,
      adminMeta: d.adminMeta,
      updatedAt: d.updatedAt,
      updatedBy: d.updatedBy,
      readOnly: this.readOnly(d),
      chunks,
      externalId: d.externalId,
    };
  }

  async knowledgeCreate(input: z.infer<typeof knowledgeDraftBody>, admin: AdminIdentity) {
    const ref = `team:${crypto.randomUUID()}`;
    const { document } = await this.store.upsertDocument({
      source: "team_answer",
      sourceRef: ref,
      externalId: null,
      title: input.title,
      url: input.url || null,
      type: input.type,
      bodyMd: input.bodyMd,
      checksum: checksumOf({
        title: input.title,
        body: input.bodyMd,
        url: input.url ?? null,
        type: input.type,
      }),
      status: "draft",
      owner: input.owner ?? admin.name,
      reviewDate: input.reviewDate ?? null,
      updatedBy: admin.name,
      meta: input.url ? { page_placements: [input.url] } : {},
      adminMeta: {},
    });
    return { document: this.documentView(document, 0) };
  }

  async knowledgeUpdate(
    id: string,
    input: z.infer<typeof knowledgeDraftBody>,
    admin: AdminIdentity,
  ) {
    const d = await this.store.getDocument(id);
    if (!d) throw new RelayError("not_found");
    if (this.readOnly(d))
      throw new RelayError("invalid", "This entry comes from its source and is read-only here.");
    // Publishing needs a SuperAdmin, so a ServiceLead's edit to a live answer takes it out of
    // retrieval as a draft until a SuperAdmin publishes it again.
    const demote = d.status === "published" && admin.role !== "SuperAdmin";
    const { document } = await this.store.upsertDocument({
      ...d,
      ...(demote ? { status: "draft" as const } : {}),
      title: input.title,
      url: input.url || null,
      type: input.type,
      bodyMd: input.bodyMd,
      owner: input.owner ?? d.owner,
      reviewDate: input.reviewDate ?? d.reviewDate,
      updatedBy: admin.name,
      checksum: checksumOf({
        title: input.title,
        body: input.bodyMd,
        url: input.url ?? null,
        type: input.type,
      }),
      meta: input.url ? { ...d.meta, page_placements: [input.url] } : d.meta,
    });
    if (demote) await this.store.replaceChunks(id, []);
    else if (document.status === "published") await this.reindexDocument(document);
    return {
      document: this.documentView(document, (await this.store.listChunksForDocument(id)).length),
    };
  }

  private entryOf(d: KbDocumentRecord): KnowledgeEntry {
    return {
      source: d.source,
      sourceRef: d.sourceRef,
      externalId: d.externalId,
      title: d.title,
      url: d.url,
      type: d.type,
      bodyMd: d.bodyMd,
      status: d.status,
      owner: d.owner,
      reviewDate: d.reviewDate,
      meta: d.meta,
      adminMeta: d.adminMeta,
      checksum: d.checksum,
      ...(d.source === "faq" && d.bodyMd
        ? {
            chunks: [
              {
                heading: d.title,
                content: d.bodyMd,
                embeddingText: `FAQ — ${d.title}: ${d.bodyMd.replace(/\s+/g, " ")}`,
              },
            ],
          }
        : {}),
    };
  }

  private async reindexDocument(d: KbDocumentRecord): Promise<IngestResult> {
    return ingestEntries(this.store, this.ctx.deps.embedder, [this.entryOf(d)], {
      force: true,
      updatedBy: d.updatedBy,
    });
  }

  async knowledgePublish(id: string, admin: AdminIdentity) {
    const d = await this.store.getDocument(id);
    if (!d) throw new RelayError("not_found");
    if (d.source !== "team_answer")
      throw new RelayError("invalid", "Only team answers are published here.");
    if (!d.bodyMd.trim()) throw new RelayError("invalid", "Write the answer before publishing.");
    const published = await this.store.setDocumentStatus(id, "published", admin.name);
    if (!published) throw new RelayError("not_found");
    await this.reindexDocument(published);
    return this.knowledgeGet(id);
  }

  async knowledgeArchive(id: string, admin: AdminIdentity) {
    const d = await this.store.getDocument(id);
    if (!d) throw new RelayError("not_found");
    if (d.source !== "team_answer")
      throw new RelayError(
        "invalid",
        "Repo, website and FAQ entries are archived at their source.",
      );
    await this.store.setDocumentStatus(id, "archived", admin.name);
    await this.store.replaceChunks(id, []);
    return this.knowledgeGet(id);
  }

  async knowledgeReindex(id: string) {
    const d = await this.store.getDocument(id);
    if (!d) throw new RelayError("not_found");
    await this.reindexDocument(d);
    return this.knowledgeGet(id);
  }

  async knowledgeReindexAll(admin: AdminIdentity) {
    const faq = await this.ports.faq.status();
    const entries = await this.ports.bundledEntries({
      includeFaqSnapshot: faq.mode === "snapshot",
    });
    const result = await ingestEntries(this.store, this.ctx.deps.embedder, entries, {
      archiveMissingFor: faq.mode === "snapshot" ? ["repo", "cms", "faq"] : ["repo", "cms"],
      repairEmbeddings: true,
      updatedBy: admin.name,
    });
    // Published team answers are re-embedded too (for example after an embedding outage).
    const team = await this.store.listDocuments({ source: "team_answer", status: "published" });
    let teamChunks = 0;
    for (const t of team) {
      const d = await this.store.getDocument(t.id);
      if (d) teamChunks += (await this.reindexDocument(d)).chunks;
    }
    return {
      documents: entries.length + team.length,
      chunks: result.chunks + teamChunks,
      errors: result.errors.length,
    };
  }

  async gaps(days: number) {
    const since = new Date(this.now().getTime() - days * 86_400_000).toISOString();
    const gaps = await this.store.listGaps(since);
    return {
      gaps: gaps.map((g) => ({
        id: g.id,
        count: g.count,
        question: g.exampleQuestion,
        lastAskedAt: g.lastAskedAt,
        status: g.status,
      })),
    };
  }

  async ignoreGap(id: string) {
    await this.store.setGapStatus(id, "ignored");
    return {};
  }

  async retrievalTest(question: string, pagePath: string | undefined) {
    const settings = await this.settings();
    const result = await retrieve(this.store, this.ctx.deps.embedder, {
      question: redact(question),
      pagePath: pagePath ?? null,
      simFloor: this.ctx.config.simFloor,
      threshold: settings.confidenceThreshold,
      embedTimeoutMs: 5000,
    });
    const per = (sim: number | null, fts: number | null) =>
      sim !== null
        ? Math.max(
            0,
            Math.min(1, (sim - this.ctx.config.simFloor) / (1 - this.ctx.config.simFloor)),
          )
        : fts
          ? Math.min(1, fts * 2)
          : 0;
    return {
      threshold: settings.confidenceThreshold,
      confident: result.confident,
      confidence: Math.round(result.confidence * 100) / 100,
      chunks: result.chunks.map((c) => ({
        documentId: c.documentId,
        title: c.title,
        heading: c.heading,
        content: c.content,
        confidence: Math.round(per(c.similarity, c.ftsRank) * 100) / 100,
        similarity: c.similarity,
        rrfScore: c.rrfScore,
        source: c.source,
        type: c.type,
      })),
    };
  }

  faqStatus() {
    return this.ports.faq.status();
  }

  async faqSync(full: boolean, admin: AdminIdentity) {
    return { run: await this.ports.faq.sync({ full, actor: admin.name }) };
  }

  // -------------------------------------------------------------------------------------------
  async insights(days: 7 | 30 | 90) {
    const since = new Date(this.now().getTime() - days * 86_400_000).toISOString();
    const [row, gaps] = await Promise.all([this.store.insights(since), this.store.listGaps(since)]);
    return {
      days,
      conversations: row.conversations,
      aiResolved: row.aiResolved,
      handoffRate: row.conversations
        ? Math.round((row.handoffs / row.conversations) * 1000) / 10
        : 0,
      handoffs: row.handoffs,
      helpful: row.helpful,
      notHelpful: row.notHelpful,
      medianFirstReplySeconds: row.medianFirstReplySeconds,
      waitingNow: row.waitingNow,
      topQuestions: row.topQuestions,
      topGaps: gaps.slice(0, 10).map((g) => ({ question: g.exampleQuestion, count: g.count })),
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      cacheHitTokens: row.cacheHitTokens,
      estCostUsd: Math.round(row.estCostUsd * 10_000) / 10_000,
    };
  }

  async getSettings() {
    return { settings: await this.settings() };
  }

  async putSettings(raw: unknown, admin: AdminIdentity) {
    const parsed = relaySettingsSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new RelayError(
        "invalid",
        first ? `${first.path.join(".")}: ${first.message}` : "Invalid settings",
      );
    }
    await this.store.putSettingsConfig(parsed.data, admin.name);
    await this.store.audit({
      actorAdminId: admin.id,
      action: "settings.updated",
      targetType: "settings",
      targetId: "1",
    });
    return { settings: parsed.data };
  }

  async emailLog() {
    const emails = await this.store.listEmails(100);
    return {
      emails: emails.map((e) => ({
        id: e.id,
        to: e.to,
        subject: e.subject,
        provider: e.provider,
        status: e.status,
        createdAt: e.createdAt,
      })),
    };
  }
}
