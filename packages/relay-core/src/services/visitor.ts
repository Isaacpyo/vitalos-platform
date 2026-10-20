import type {
  ChatEvent,
  CreateConversationResponse,
  MessagesResponse,
  NextStep,
  SystemEvent,
  TeamStatus,
  VisitorMessage,
  WidgetSettings,
} from "../contract";
import { COPY } from "../contract";
import type { ConversationRecord, MessageRecord } from "../db/types";
import { isExplicitHandoffRequest, normaliseQuestion } from "../handoff/intent";
import { finaliseCitations, nextStepFor, publicCitations } from "../llm/citations";
import { MarkerGuard, stripMarkers } from "../llm/markers";
import { buildUserMessage } from "../llm/prompts/context";
import { SUMMARY_SYSTEM_PROMPT, SYSTEM_PROMPT } from "../llm/prompts/system";
import type { ChatTurn, Usage } from "../llm/provider";
import { estimateCostUsd } from "../llm/provider";
import { redact } from "../redact/redact";
import { retrieve } from "../retrieval/search";
import type { chatBody, createConversationBody, feedbackBody, handoffBody } from "../schemas/api";
import { parseStoredSettings } from "../schemas/settings";
import type { RelaySettings } from "../schemas/settings";
import { deviceLabel, teamStatus as computeTeamStatus, withinBusinessHours } from "../util/team";
import {
  hmacHex,
  initialsOf,
  randomToken,
  safeEqual,
  sha256Hex,
  visitorLabel,
} from "../util/tokens";
import { ensureCaseId } from "./case-id";
import type { RelayContext } from "./context";
import { RelayError } from "./context";
import type { z } from "zod";

export interface RequestMeta {
  ip: string | undefined;
  userAgent: string | null;
  country: string | null;
}

export type ChatResult =
  | { kind: "stream"; events: AsyncGenerator<ChatEvent> }
  /** A person is handling the conversation: the message is stored and delivered, no AI reply. */
  | { kind: "accepted"; visitorMessageId: string };

export const LIMITS = {
  conversationsPerIpPerHour: 30,
  messagesPerIpPer10Min: 20,
  messagesPerConversationPerDay: 60,
  aiTurnsPerConversation: 30,
  historyTurns: 8,
  historyTokens: 3000,
  typingPerConversationPer10s: 4,
} as const;

const AI_TURN_LIMIT_TEXT =
  "We've covered a lot here. A person from the team can pick this up from here.";

const tokens = (text: string) => Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.33);

/** The visitor-facing API of Relay (section 5.2). Every method authenticates first. */
export class VisitorService {
  constructor(private readonly ctx: RelayContext) {}

  private get store() {
    return this.ctx.deps.store;
  }

  private get limitScale() {
    return this.ctx.config.rateLimitMultiplier ?? 1;
  }

  async settings(): Promise<RelaySettings> {
    return parseStoredSettings(await this.store.getSettingsConfig());
  }

  async teamStatus(settings?: RelaySettings): Promise<TeamStatus> {
    const s = settings ?? (await this.settings());
    return computeTeamStatus(await this.store.listPresence(), s, this.ctx.deps.now());
  }

  widgetSettings(settings: RelaySettings, team: TeamStatus): WidgetSettings {
    return {
      greeting: settings.greeting,
      suggestedQuestions: settings.suggestedQuestions,
      teamStatus: team,
      outOfHoursText: settings.outOfHoursText,
      privacyUrl: this.ctx.config.privacyUrl,
      noticeVersion: this.ctx.config.privacyNoticeVersion,
      aiEnabled: settings.aiEnabled && this.ctx.config.aiEnabled,
    };
  }

  private ipHash(ip: string | undefined): string | null {
    return ip ? hmacHex(this.ctx.config.ipSalt, ip).slice(0, 64) : null;
  }

  /** Throws `rate_limited` once `key` has been used `max` times in the window (test-scalable). */
  private async limit(key: string, windowSeconds: number, max: number): Promise<void> {
    if (!(await this.store.hitRateLimit(key, windowSeconds, max * this.limitScale)))
      throw new RelayError("rate_limited", COPY.rateLimited);
  }

  /** Per-IP limit for unauthenticated reads and token exchanges (suggestions, resume). */
  async limitByIp(scope: string, meta: RequestMeta, windowSeconds: number, max: number) {
    const ipHash = this.ipHash(meta.ip);
    if (ipHash) await this.limit(`${scope}:ip:${ipHash}`, windowSeconds, max);
  }

  // -------------------------------------------------------------------------------------------
  async createConversation(
    body: z.infer<typeof createConversationBody>,
    meta: RequestMeta,
  ): Promise<CreateConversationResponse> {
    if (this.ctx.config.turnstileRequired) {
      const check = await this.ctx.deps.human.verify(body.turnstileToken, meta.ip);
      if (check === "failed") throw new RelayError("turnstile_failed", COPY.sendFailed);
      if (check === "unavailable") throw new RelayError("unavailable", COPY.sendFailed);
    }
    const ipHash = this.ipHash(meta.ip);
    if (
      ipHash &&
      !(await this.store.hitRateLimit(
        `conv:ip:${ipHash}`,
        3600,
        LIMITS.conversationsPerIpPerHour * this.limitScale,
      ))
    ) {
      throw new RelayError("rate_limited", COPY.rateLimited);
    }
    const visitorToken = randomToken();
    const channelKey = randomToken();
    const pageUrl = new URL(body.pageUrl);
    const conversation = await this.store.createConversation({
      visitorTokenHash: hmacHex(this.ctx.config.tokenPepper, visitorToken),
      channelKey,
      pageUrl: `${pageUrl.origin}${pageUrl.pathname}`.slice(0, 500),
      pageTitle: body.pageTitle ?? null,
      referrer: body.referrer ? safeReferrer(body.referrer) : null,
      utm: body.utm ?? {},
      userAgent: meta.userAgent?.slice(0, 400) ?? null,
      device: deviceLabel(meta.userAgent),
      country: meta.country && /^[A-Z]{2}$/.test(meta.country) ? meta.country : null,
      ipHash,
    });
    const settings = await this.settings();
    const team = await this.teamStatus(settings);
    return {
      conversationId: conversation.id,
      visitorToken,
      channelKey,
      realtime: this.ctx.config.realtime
        ? {
            url: this.ctx.config.realtime.url,
            key: this.ctx.config.realtime.publicKey,
            channel: `relay:v:${channelKey}`,
          }
        : null,
      settings: this.widgetSettings(settings, team),
    };
  }

  /** Bearer-token check in constant time. Unknown ids and wrong tokens look the same. */
  async authenticate(conversationId: string, bearer: string | null): Promise<ConversationRecord> {
    const conversation = await this.store.getConversation(conversationId);
    const presented = bearer ? hmacHex(this.ctx.config.tokenPepper, bearer) : "";
    const expected = conversation?.visitorTokenHash ?? "0".repeat(64);
    if (!conversation || !bearer || !safeEqual(presented, expected))
      throw new RelayError("unauthorised", COPY.unauthorised);
    return conversation;
  }

  private async addTags(c: ConversationRecord, ...tags: string[]): Promise<void> {
    const next = [...new Set([...c.tags, ...tags])];
    if (next.length !== c.tags.length) await this.store.updateConversation(c.id, { tags: next });
  }

  private async counts() {
    const c = await this.store.inboxCounts();
    return { needs: c.needs, live: c.live };
  }

  // -------------------------------------------------------------------------------------------
  async chat(
    body: z.infer<typeof chatBody>,
    bearer: string | null,
    meta: RequestMeta,
    abortSignal: AbortSignal,
  ): Promise<ChatResult> {
    const conversation = await this.authenticate(body.conversationId, bearer);
    if (conversation.status === "closed") throw new RelayError("conversation_closed", COPY.closed);

    const ipHash = this.ipHash(meta.ip);
    const allowedIp = ipHash
      ? await this.store.hitRateLimit(
          `msg:ip:${ipHash}`,
          600,
          LIMITS.messagesPerIpPer10Min * this.limitScale,
        )
      : true;
    const allowedConv = await this.store.hitRateLimit(
      `msg:conv:${conversation.id}`,
      86_400,
      LIMITS.messagesPerConversationPerDay * this.limitScale,
    );
    if (!allowedIp || !allowedConv) throw new RelayError("rate_limited", COPY.rateLimited);

    const now = this.ctx.deps.now();
    const redacted = redact(body.text);
    const { message: visitorMessage, duplicate } = await this.store.insertMessage({
      conversationId: conversation.id,
      senderType: "visitor",
      body: body.text,
      bodyRedacted: redacted,
      clientMessageId: body.clientMessageId,
    });
    const pageUrl = new URL(body.pageUrl);
    await this.store.updateConversation(conversation.id, {
      lastMessageAt: now.toISOString(),
      lastVisitorSeenAt: now.toISOString(),
      pageUrl: `${pageUrl.origin}${pageUrl.pathname}`.slice(0, 500),
    });

    if (conversation.status === "human") {
      if (!duplicate) {
        this.ctx.deps.defer(async () => {
          await this.ctx.deps.broadcaster.admins("inbox_changed", {
            conversationId: conversation.id,
          });
          const settings = await this.settings();
          await this.ctx.deps.notifier.send({
            type: "visitor.replied",
            counts: await this.counts(),
            data: {
              conversationId: conversation.id,
              caseId: conversation.caseId,
              displayName: conversation.contactName ?? visitorLabel(conversation.id),
              assignedAdminId: conversation.assignedAdminId,
              lastVisitorMessage: settings.emailSnippet ? body.text.slice(0, 280) : null,
              pagePath: pageUrl.pathname,
            },
          });
        });
      }
      return { kind: "accepted", visitorMessageId: visitorMessage.id };
    }
    if (conversation.status === "awaiting_human" && !duplicate) {
      this.ctx.deps.defer(() =>
        this.ctx.deps.broadcaster.admins("inbox_changed", { conversationId: conversation.id }),
      );
    }

    if (duplicate) {
      const after = (
        await this.store.listMessages(conversation.id, { after: visitorMessage.createdAt })
      ).find((m) => m.senderType === "ai");
      if (after) return { kind: "stream", events: replay(visitorMessage, after) };
    }

    return {
      kind: "stream",
      events: this.answer(conversation, visitorMessage, redacted, pageUrl.pathname, abortSignal),
    };
  }

  private async *answer(
    conversation: ConversationRecord,
    visitorMessage: MessageRecord,
    redacted: string,
    pagePath: string,
    abortSignal: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const deps = this.ctx.deps;
    const settings = await this.settings();
    const aiMessageId = crypto.randomUUID();
    yield { event: "meta", data: { messageId: aiMessageId, visitorMessageId: visitorMessage.id } };

    // Explicit request for a person: no model call.
    if (isExplicitHandoffRequest(visitorMessage.body)) {
      await this.addTags(conversation, "ASKED_FOR_A_PERSON");
      yield* this.cannedAnswer(conversation, aiMessageId, COPY.explicitHandoff, { handoff: true });
      return;
    }
    if (conversation.aiTurns >= LIMITS.aiTurnsPerConversation) {
      yield* this.cannedAnswer(conversation, aiMessageId, AI_TURN_LIMIT_TEXT, { handoff: true });
      return;
    }
    if (!settings.aiEnabled || !this.ctx.config.aiEnabled) {
      yield { event: "error", data: { code: "unavailable", message: COPY.unavailable } };
      return;
    }
    const day = deps.now().toISOString().slice(0, 10);
    const cap = Math.min(settings.dailyTokenCap, this.ctx.config.dailyTokenCap);
    const usageToday = await deps.store.getUsage(day);
    if (usageToday && usageToday.tokensIn + usageToday.tokensOut >= cap) {
      deps.defer(async () => {
        if (await deps.store.markCapNotified(day)) {
          await deps.notifier.send({
            type: "relay.token_cap",
            counts: await this.counts(),
            data: { day, tokensUsed: usageToday.tokensIn + usageToday.tokensOut, cap },
          });
        }
      });
      yield { event: "error", data: { code: "unavailable", message: COPY.unavailable } };
      return;
    }

    // Retrieval and confidence
    const history = await deps.store.listMessages(conversation.id, { limit: 200 });
    const earlier = history.filter(
      (m) => m.id !== visitorMessage.id && m.createdAt <= visitorMessage.createdAt,
    );
    const previousQuestion = [...earlier].reverse().find((m) => m.senderType === "visitor");
    const retrieval = await retrieve(deps.store, deps.embedder, {
      question: redacted,
      previousQuestion: previousQuestion
        ? (previousQuestion.bodyRedacted ?? redact(previousQuestion.body))
        : null,
      pagePath,
      simFloor: this.ctx.config.simFloor,
      threshold: settings.confidenceThreshold,
    });
    const lowConfidence = !retrieval.confident;
    const sources = lowConfidence ? [] : retrieval.chunks;
    const team = await this.teamStatus(settings);

    const messages: ChatTurn[] = [
      ...historyTurns(earlier),
      {
        role: "user",
        content: buildUserMessage({
          pagePath,
          // Visitor-supplied (document.title), so it is redacted like the question.
          pageTitle: conversation.pageTitle ? redact(conversation.pageTitle) : null,
          teamOnline: team === "online",
          now: deps.now(),
          confident: !lowConfidence,
          sources,
          question: redacted,
        }),
      },
    ];

    const started = Date.now();
    let firstTokenMs: number | null = null;
    const guard = new MarkerGuard();
    let usage: Usage = { inputTokens: 0, outputTokens: 0, cacheHitTokens: 0 };
    let completed = false;
    let failed: "timeout" | "rate_limited" | "unavailable" | "aborted" | null = null;

    try {
      for await (const ev of deps.llm.streamAnswer({
        system: SYSTEM_PROMPT,
        messages: mergeTurns(messages),
        model: settings.model || this.ctx.config.model,
        abortSignal,
        userRef: sha256Hex(conversation.id).slice(0, 32),
      })) {
        if (ev.type === "delta") {
          firstTokenMs ??= Date.now() - started;
          const safe = guard.push(ev.text);
          if (safe) yield { event: "delta", data: { text: safe } };
        } else if (ev.type === "done") {
          usage = ev.usage;
          completed = true;
        } else {
          failed = ev.code;
        }
      }
    } finally {
      if (!completed) {
        // The provider bills a stream that started even when it never finishes, so count an
        // estimate (about 4 characters a token) against the daily cap; aborting can't dodge it.
        if (firstTokenMs !== null) {
          const estimate: Usage = {
            inputTokens: Math.ceil(
              (SYSTEM_PROMPT.length + messages.reduce((n, m) => n + m.content.length, 0)) / 4,
            ),
            outputTokens: Math.ceil(guard.partial().length / 4),
            cacheHitTokens: 0,
          };
          const cost = estimateCostUsd(estimate, settings.model, deps.now());
          deps.defer(() =>
            deps.store.addUsage(day, estimate.inputTokens, estimate.outputTokens, 0, cost),
          );
        }
        // Stopped by the visitor or failed: keep what was written, marked truncated.
        const partial = stripMarkers(guard.partial());
        if (partial && (abortSignal.aborted || failed === "aborted")) {
          const { text, citations } = finaliseCitations(partial, sources);
          await deps.store.insertMessage({
            id: aiMessageId,
            conversationId: conversation.id,
            senderType: "ai",
            body: text,
            citations,
            confidence: retrieval.confidence,
            truncated: true,
            model: settings.model,
            latencyMs: Date.now() - started,
            firstTokenMs,
            meta: { low_confidence: lowConfidence },
          });
        }
      }
    }

    if (!completed) {
      if (failed && failed !== "aborted") {
        deps.logger.warn("relay.llm_failed", { code: failed, conversationId: conversation.id });
        yield { event: "error", data: { code: "unavailable", message: COPY.unavailable } };
      }
      return;
    }

    const { rest, text: visible, handoff: marker } = guard.finish();
    if (rest) yield { event: "delta", data: { text: rest } };
    const { text, citations } = finaliseCitations(visible || COPY.lowConfidenceLead, sources);
    const nextStep: NextStep | null = nextStepFor(citations, sources);
    const handoffSuggested = marker || lowConfidence;
    const latencyMs = Date.now() - started;

    await deps.store.insertMessage({
      id: aiMessageId,
      conversationId: conversation.id,
      senderType: "ai",
      body: text,
      citations,
      confidence: retrieval.confidence,
      handoffSuggested,
      model: settings.model,
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      cacheHitTokens: usage.cacheHitTokens,
      latencyMs,
      firstTokenMs,
      meta: { low_confidence: lowConfidence, next_step: nextStep, sources_count: citations.length },
    });
    await deps.store.updateConversation(conversation.id, {
      aiTurns: conversation.aiTurns + 1,
      lastMessageAt: deps.now().toISOString(),
    });
    const tags = [
      ...(lowConfidence ? ["NOT_IN_KNOWLEDGE"] : []),
      ...(marker ? ["MODEL_FLAG"] : []),
    ];
    if (tags.length) await this.addTags(conversation, ...tags);

    deps.defer(async () => {
      await deps.store.addUsage(
        day,
        usage.inputTokens,
        usage.outputTokens,
        usage.cacheHitTokens,
        estimateCostUsd(usage, settings.model, deps.now()),
      );
      if (lowConfidence) {
        await deps.store.recordGap(normaliseQuestion(redacted), redacted, conversation.id);
        if (conversation.status === "ai") {
          await deps.notifier.send({
            type: "relay.no_answer",
            counts: await this.counts(),
            data: { conversationId: conversation.id, question: redacted.slice(0, 280), pagePath },
          });
        }
      }
      if (conversation.status !== "ai")
        await deps.broadcaster.admins("inbox_changed", { conversationId: conversation.id });
    });

    yield {
      event: "done",
      data: {
        messageId: aiMessageId,
        text,
        citations: publicCitations(citations),
        nextStep,
        handoffSuggested,
        lowConfidence,
        confidence: Math.round(retrieval.confidence * 100) / 100,
      },
    };
  }

  private async *cannedAnswer(
    conversation: ConversationRecord,
    messageId: string,
    text: string,
    options: { handoff: boolean },
  ): AsyncGenerator<ChatEvent> {
    await this.store.insertMessage({
      id: messageId,
      conversationId: conversation.id,
      senderType: "ai",
      body: text,
      handoffSuggested: options.handoff,
      meta: { canned: true },
    });
    yield { event: "delta", data: { text } };
    yield {
      event: "done",
      data: {
        messageId,
        text,
        citations: [],
        nextStep: null,
        handoffSuggested: options.handoff,
        lowConfidence: false,
        confidence: 1,
      },
    };
  }

  // -------------------------------------------------------------------------------------------
  async feedback(
    body: z.infer<typeof feedbackBody>,
    bearer: string | null,
  ): Promise<{ showHandoff: boolean }> {
    const conversation = await this.authenticate(body.conversationId, bearer);
    await this.limit(`feedback:${conversation.id}`, 600, 30);
    const message = await this.store.getMessage(body.messageId);
    // Two kinds of rating: an AI answer, or the whole conversation once it is closed (the review
    // under "CONVERSATION CLOSED", owner direction 16 Oct 2026).
    const closingReview = message?.senderType === "system" && message.body === "closed";
    if (
      !message ||
      message.conversationId !== conversation.id ||
      (message.senderType !== "ai" && !closingReview)
    )
      throw new RelayError("not_found");
    await this.store.updateMessage(message.id, {
      feedback: body.value,
      feedbackAt: this.ctx.deps.now().toISOString(),
    });
    if (closingReview) {
      await this.addTags(conversation, body.value === 1 ? "RATED_HELPFUL" : "RATED_NOT_HELPFUL");
      this.ctx.deps.defer(() =>
        this.ctx.deps.broadcaster.admins("inbox_changed", { conversationId: conversation.id }),
      );
      return { showHandoff: false };
    }
    if (body.value === -1) {
      await this.addTags(conversation, "NOT_HELPFUL");
      const question = [...(await this.store.listMessages(conversation.id))]
        .filter((m) => m.senderType === "visitor" && m.createdAt <= message.createdAt)
        .at(-1);
      if (question) {
        const redacted = question.bodyRedacted ?? redact(question.body);
        await this.store.recordGap(normaliseQuestion(redacted), redacted, conversation.id);
      }
    }
    return { showHandoff: body.value === -1 };
  }

  async handoff(
    body: z.infer<typeof handoffBody>,
    bearer: string | null,
  ): Promise<{
    status: "awaiting_human" | "human";
    teamStatus: TeamStatus;
    outOfHours: boolean;
    caseId: string;
  }> {
    const conversation = await this.authenticate(body.conversationId, bearer);
    if (conversation.status === "closed") throw new RelayError("conversation_closed", COPY.closed);
    await this.limit(`handoff:${conversation.id}`, 600, 5);
    if (body.noticeVersion !== this.ctx.config.privacyNoticeVersion)
      throw new RelayError(
        "invalid",
        "The privacy notice has changed. Reload the page and try again.",
      );
    const deps = this.ctx.deps;
    const now = deps.now();
    const settings = await this.settings();
    const team = await this.teamStatus(settings);
    const outOfHours = !withinBusinessHours(settings, now);

    const updated = await this.store.updateConversation(conversation.id, {
      contactName: body.name,
      contactEmail: body.email.toLowerCase(),
      contactCompany: body.company ?? null,
      consentAt: now.toISOString(),
      consentNoticeVersion: body.noticeVersion,
      status: conversation.status === "human" ? "human" : "awaiting_human",
      lastMessageAt: now.toISOString(),
    });
    if (!updated) throw new RelayError("not_found");
    const caseId = await ensureCaseId(this.store, deps.now, updated);
    if (conversation.status === "human")
      return { status: "human", teamStatus: team, outOfHours, caseId };

    // A repeat request (new details, double submit) updates the contact fields only: one alert
    // and one summary per open hand-off.
    const existing = await this.store.openHandoff(conversation.id);
    if (existing) return { status: "awaiting_human", teamStatus: team, outOfHours, caseId };
    const lastAi = [...(await this.store.listMessages(conversation.id))]
      .reverse()
      .find((m) => m.senderType === "ai");
    await this.store.createHandoff({
      conversationId: conversation.id,
      trigger: body.trigger,
      messageId: lastAi?.id ?? null,
    });
    await this.store.insertMessage({
      conversationId: conversation.id,
      senderType: "system",
      body: "handoff_requested",
      meta: {
        trigger: body.trigger,
        consent: true,
        outOfHours,
        email: body.email.toLowerCase(),
        caseId,
      },
    });
    const tags =
      body.trigger === "explicit_request"
        ? ["ASKED_FOR_A_PERSON"]
        : body.trigger === "not_helpful"
          ? ["NOT_HELPFUL"]
          : [];
    if (tags.length) await this.addTags(updated, ...tags);

    const lastVisitor = [...(await this.store.listMessages(conversation.id))]
      .reverse()
      .find((m) => m.senderType === "visitor");
    const pagePath = conversation.pageUrl ? new URL(conversation.pageUrl).pathname : null;
    deps.defer(async () => {
      await deps.broadcaster.admins("inbox_changed", { conversationId: conversation.id });
      await deps.notifier.send({
        type: "handoff.requested",
        counts: await this.counts(),
        data: {
          conversationId: conversation.id,
          caseId,
          displayName: body.name,
          trigger: body.trigger,
          lastVisitorMessage:
            settings.emailSnippet && lastVisitor ? lastVisitor.body.slice(0, 280) : null,
          pagePath,
          requestedAt: now.toISOString(),
        },
      });
      await this.summarise(conversation.id);
    });
    return { status: "awaiting_human", teamStatus: team, outOfHours, caseId };
  }

  /** Admin summary on the redacted transcript (section 5.4). Failure never blocks the hand-off. */
  async summarise(conversationId: string): Promise<void> {
    try {
      const messages = await this.store.listMessages(conversationId);
      const transcript = messages
        .filter((m) => m.senderType === "visitor" || m.senderType === "ai")
        .map(
          (m) =>
            `${m.senderType === "visitor" ? "VISITOR" : "RELAY"}: ${m.senderType === "visitor" ? (m.bodyRedacted ?? redact(m.body)) : stripCitationMarkers(m.body)}`,
        )
        .join("\n")
        .slice(-12_000);
      if (!transcript) return;
      const result = await this.ctx.deps.llm.generateSummary({
        system: SUMMARY_SYSTEM_PROMPT,
        transcript,
        model: this.ctx.config.summaryModel,
        abortSignal: AbortSignal.timeout(20_000),
      });
      if (!result) return;
      const now = this.ctx.deps.now();
      await this.store.addUsage(
        now.toISOString().slice(0, 10),
        result.usage.inputTokens,
        result.usage.outputTokens,
        result.usage.cacheHitTokens,
        estimateCostUsd(result.usage, this.ctx.config.summaryModel, now),
      );
      await this.store.updateConversation(conversationId, {
        summary: redact(result.output.summary).slice(0, 600),
        summaryMeta: {
          intent: result.output.intent,
          sector: result.output.sector,
          urgency: result.output.urgency,
        },
      });
    } catch (error) {
      this.ctx.deps.logger.warn("relay.summary_failed", {
        conversationId,
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  async messages(
    conversationId: string,
    bearer: string | null,
    after?: string,
  ): Promise<MessagesResponse> {
    const conversation = await this.authenticate(conversationId, bearer);
    await this.store.updateConversation(conversation.id, {
      lastVisitorSeenAt: this.ctx.deps.now().toISOString(),
    });
    const list = await this.store.listMessages(conversation.id, after ? { after } : {});
    const team = await this.teamStatus();
    return {
      messages: list.filter((m) => m.senderType !== "note").map(toVisitorMessage),
      status: conversation.status,
      person:
        conversation.status === "human" && conversation.assignedAdminName
          ? {
              name: conversation.assignedAdminName,
              initials:
                conversation.assignedAdminInitials ?? initialsOf(conversation.assignedAdminName),
            }
          : null,
      teamStatus: team,
      contact:
        conversation.contactName && conversation.contactEmail
          ? { name: conversation.contactName, email: conversation.contactEmail }
          : null,
      caseId: conversation.caseId,
    };
  }

  async typing(conversationId: string, bearer: string | null): Promise<void> {
    const conversation = await this.authenticate(conversationId, bearer);
    if (conversation.status !== "human" && conversation.status !== "awaiting_human") return;
    if (
      !(await this.store.hitRateLimit(
        `typing:${conversation.id}`,
        10,
        LIMITS.typingPerConversationPer10s,
      ))
    )
      return;
    await this.ctx.deps.broadcaster.admins("typing", {
      conversationId: conversation.id,
      by: "visitor",
    });
  }

  async end(conversationId: string, bearer: string | null): Promise<void> {
    const conversation = await this.authenticate(conversationId, bearer);
    if (conversation.status === "closed") return;
    await this.limit(`end:${conversation.id}`, 600, 10);
    const now = this.ctx.deps.now().toISOString();
    await this.store.updateConversation(conversation.id, {
      status: "closed",
      closedAt: now,
      closedReason: "visitor_ended",
    });
    const open = await this.store.openHandoff(conversation.id);
    if (open) await this.store.updateHandoff(open.id, { resolvedAt: now });
    await this.store.insertMessage({
      conversationId: conversation.id,
      senderType: "system",
      body: "closed",
      meta: { by: "visitor" },
    });
    this.ctx.deps.defer(() =>
      this.ctx.deps.broadcaster.admins("inbox_changed", { conversationId: conversation.id }),
    );
  }

  /** "Delete this conversation": hard delete now, audit row with a hashed id only. */
  async remove(conversationId: string, bearer: string | null): Promise<void> {
    const conversation = await this.authenticate(conversationId, bearer);
    await this.store.deleteConversation(conversation.id);
    await this.store.audit({
      actorAdminId: null,
      action: "conversation.deleted_by_visitor",
      targetType: "conversation",
      targetId: sha256Hex(conversation.id).slice(0, 32),
    });
    this.ctx.deps.defer(() => this.ctx.deps.broadcaster.admins("inbox_changed"));
  }

  /**
   * Resume link from a visitor reply email: single use, 7 days. Issues a fresh visitor token, which
   * also invalidates the old one, so a forwarded email cannot reopen the conversation twice.
   */
  async resume(token: string): Promise<CreateConversationResponse> {
    const { resumeTokenHash } = await import("./visitor-email");
    const now = this.ctx.deps.now().toISOString();
    const conversationId = await this.store.consumeResumeToken(
      resumeTokenHash(this.ctx, token),
      now,
    );
    if (!conversationId)
      throw new RelayError("unauthorised", "This link has expired. Start a new conversation.");
    const conversation = await this.store.getConversation(conversationId);
    if (!conversation)
      throw new RelayError("unauthorised", "This link has expired. Start a new conversation.");
    const visitorToken = randomToken();
    await this.store.updateConversation(conversation.id, {
      visitorTokenHash: hmacHex(this.ctx.config.tokenPepper, visitorToken),
      lastVisitorSeenAt: now,
    });
    const settings = await this.settings();
    return {
      conversationId: conversation.id,
      visitorToken,
      channelKey: conversation.channelKey,
      realtime: this.ctx.config.realtime
        ? {
            url: this.ctx.config.realtime.url,
            key: this.ctx.config.realtime.publicKey,
            channel: `relay:v:${conversation.channelKey}`,
          }
        : null,
      settings: this.widgetSettings(settings, await this.teamStatus(settings)),
    };
  }

  /** START WITH: up to four Verified FAQ questions placed on this page, else the Settings defaults. */
  async suggestions(pagePath: string): Promise<string[]> {
    const settings = await this.settings();
    const path = trimTrailing(pagePath.split("?")[0] ?? "", "/") || "/";
    const rows = await this.store.faqQuestionsForPage(path, 4);
    const ranked = rows
      .map((r) => ({ ...r, specificity: r.placements.indexOf(path) === 0 ? 0 : 1 }))
      .sort(
        (a, b) =>
          a.specificity - b.specificity ||
          a.sectionOrder - b.sectionOrder ||
          a.question.localeCompare(b.question),
      )
      .map((r) => r.question);
    const unique = [...new Set(ranked)].slice(0, 4);
    return unique.length > 0 ? unique : settings.suggestedQuestions.slice(0, 4);
  }
}

// ---------------------------------------------------------------------------------------------
function safeReferrer(value: string): string | null {
  if (!URL.canParse(value)) return null;
  const u = new URL(value);
  return /^https?:$/.test(u.protocol) ? `${u.origin}${u.pathname}`.slice(0, 500) : null;
}

const stripCitationMarkers = (text: string) =>
  text.replace(/\[\d{1,2}\]/g, "").replace(/ +([.,;:])/g, "$1");

/** Last 8 turns as plain text: visitor redacted, AI without citation markers, admins labelled. */
export function historyTurns(earlier: readonly MessageRecord[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const m of earlier) {
    if (m.senderType === "visitor")
      turns.push({ role: "user", content: m.bodyRedacted ?? redact(m.body) });
    else if (m.senderType === "ai" && !m.meta.canned)
      turns.push({ role: "assistant", content: stripCitationMarkers(m.body) });
    else if (m.senderType === "admin")
      turns.push({ role: "assistant", content: `[Vitalos team] ${redact(m.body)}` });
  }
  const recent = turns.slice(-LIMITS.historyTurns);
  let total = recent.reduce((s, t) => s + tokens(t.content), 0);
  while (recent.length > 0 && total > LIMITS.historyTokens) {
    total -= tokens((recent.shift() as ChatTurn).content);
  }
  // The first turn sent to the model must be the visitor's.
  while (recent[0]?.role === "assistant") recent.shift();
  return recent;
}

/** Merges consecutive turns from the same role (OpenAI-compatible APIs expect alternation). */
export function mergeTurns(turns: readonly ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const last = out.at(-1);
    if (last && last.role === t.role) last.content = `${last.content}\n\n${t.content}`;
    else out.push({ ...t });
  }
  return out;
}

export function toVisitorMessage(m: MessageRecord): VisitorMessage {
  const base = { id: m.id, body: m.body, createdAt: m.createdAt };
  switch (m.senderType) {
    case "ai":
      return {
        ...base,
        senderType: "ai",
        citations: publicCitations(m.citations),
        nextStep: (m.meta.next_step as NextStep | null | undefined) ?? null,
        handoffSuggested: m.handoffSuggested,
        lowConfidence: Boolean(m.meta.low_confidence),
        feedback: m.feedback,
        truncated: m.truncated,
      };
    case "admin":
      return {
        ...base,
        senderType: "admin",
        adminName: m.adminName,
        adminInitials: m.adminInitials,
      };
    case "system": {
      const meta = m.meta as {
        name?: string;
        email?: string;
        outOfHours?: boolean;
        caseId?: string;
      };
      return {
        ...base,
        senderType: "system",
        event: m.body as SystemEvent,
        ...(m.body === "closed" ? { feedback: m.feedback } : {}),
        meta: {
          ...(meta.name ? { name: meta.name } : {}),
          ...(meta.email ? { email: meta.email } : {}),
          ...(meta.outOfHours ? { outOfHours: true } : {}),
          ...(meta.caseId ? { caseId: meta.caseId } : {}),
        },
      };
    }
    default:
      return { ...base, senderType: "visitor" };
  }
}

async function* replay(visitor: MessageRecord, ai: MessageRecord): AsyncGenerator<ChatEvent> {
  await Promise.resolve();
  yield { event: "meta", data: { messageId: ai.id, visitorMessageId: visitor.id } };
  yield { event: "delta", data: { text: ai.body } };
  yield {
    event: "done",
    data: {
      messageId: ai.id,
      text: ai.body,
      citations: publicCitations(ai.citations),
      nextStep: (ai.meta.next_step as NextStep | null | undefined) ?? null,
      handoffSuggested: ai.handoffSuggested,
      lowConfidence: Boolean(ai.meta.low_confidence),
      confidence: ai.confidence ?? 0,
    },
  };
}

/** Removes trailing `char`s without a regex (avoids polynomial backtracking on long input). */
export function trimTrailing(value: string, char: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === char) end -= 1;
  return value.slice(0, end);
}
