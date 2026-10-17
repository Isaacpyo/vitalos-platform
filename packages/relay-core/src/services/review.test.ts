/**
 * Relay review fixes, 17 Oct 2026 (ADR-048): hand-off rate (E1), budget (D1), small talk and
 * typo tolerance (D2), staff names (D3), sync and Overview (D4), next opening (D5), reasons (D6).
 */
import { describe, expect, it } from "vitest";
import type { ChatEvent } from "../contract";
import type { MatchedChunk } from "../db/types";
import { smallTalkKind } from "../handoff/smalltalk";
import { chunksFor, ingestEntries } from "../knowledge/ingest";
import type { KnowledgeEntry } from "../knowledge/types";
import { estimatePromptTokens, estimateTokens, PROMPT_BUDGET } from "../llm/budget";
import type { LlmProvider } from "../llm/provider";
import { SYSTEM_PROMPT } from "../llm/prompts/system";
import { nullEmbedder } from "../retrieval/embed";
import { composeQuery, trimToBudget } from "../retrieval/search";
import { buildVocabulary, correctSpelling, editDistance } from "../retrieval/spelling";
import { parseStoredSettings } from "../schemas/settings";
import { memoryContext } from "../testing";
import { nextOpening } from "../util/team";
import { publicStaffName } from "../util/tokens";
import { AdminService, handoffRate } from "./admin";
import { assemblePrompt, VisitorService } from "./visitor";

const META = { ip: "203.0.113.20", userAgent: "Mozilla/5.0 Chrome/130", country: "GB" };

const entry = (id: string, title: string, body: string, extra: Partial<KnowledgeEntry> = {}) =>
  ({
    source: "repo",
    sourceRef: `repo:${id}`,
    externalId: id,
    title,
    url: `/solutions/${id}`,
    type: "solution",
    bodyMd: body,
    status: "published",
    owner: null,
    reviewDate: null,
    meta: {},
    adminMeta: {},
    checksum: id,
    ...extra,
  }) satisfies KnowledgeEntry;

async function collect(events: AsyncIterable<ChatEvent>) {
  const out: ChatEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

function counting(inner: LlmProvider) {
  const inputs: number[] = [];
  const provider: LlmProvider = {
    name: inner.name,
    streamAnswer(input) {
      inputs.push(estimatePromptTokens(input.system, input.messages));
      return inner.streamAnswer(input);
    },
    generateSummary: (input) => inner.generateSummary(input),
  };
  return { provider, inputs };
}

const FAQ_STATUS = {
  sync: () => Promise.reject(new Error("not in test")),
  status: () =>
    Promise.resolve({
      mode: "snapshot" as const,
      hubActive: false,
      needsConfirmation: [
        { externalId: "X-01", question: null, section: "1", confirmNote: null, notionUrl: null },
      ],
      held: [],
      lastRun: null,
    }),
};

async function setup(now?: () => Date) {
  const t = memoryContext({}, now);
  const { provider, inputs } = counting(t.ctx.deps.llm);
  t.ctx.deps.llm = provider;
  await ingestEntries(t.store, nullEmbedder, [
    entry(
      "solutions",
      "Our solutions",
      "Six solutions describe the business problems we solve, including Application Modernisation.",
    ),
    entry(
      "application-modernisation",
      "Application Modernisation",
      "We modernise legacy systems in controlled stages while the business keeps running.",
    ),
  ]);
  const visitor = new VisitorService(t.ctx);
  const admin = new AdminService(t.ctx, {
    bundledEntries: () => Promise.resolve([]),
    faq: FAQ_STATUS,
  });
  const created = await visitor.createConversation({ pageUrl: "http://localhost:3000/" }, META);
  const ask = async (text: string) => {
    const r = await visitor.chat(
      {
        conversationId: created.conversationId,
        clientMessageId: crypto.randomUUID(),
        text,
        pageUrl: "http://localhost:3000/",
      },
      created.visitorToken,
      META,
      new AbortController().signal,
    );
    if (r.kind !== "stream") throw new Error("expected a stream");
    const events = await collect(r.events);
    const done = events.find((e) => e.event === "done");
    return done?.event === "done" ? done.data : null;
  };
  return { ...t, visitor, admin, created, ask, inputs };
}

describe("E1 hand-off rate", () => {
  it("is a fraction: 4 conversations, 1 hand-off is 0.25", () => {
    expect(handoffRate(1, 4)).toBe(0.25);
    expect(handoffRate(0, 0)).toBe(0);
    expect(handoffRate(5, 4)).toBe(1);
    expect(handoffRate(1, 3)).toBe(0.333);
  });

  it("insights report 0.25 for four conversations with one hand-off", async () => {
    const t = memoryContext();
    const visitor = new VisitorService(t.ctx);
    const admin = new AdminService(t.ctx, {
      bundledEntries: () => Promise.resolve([]),
      faq: FAQ_STATUS,
    });
    const convs = [];
    for (let i = 0; i < 4; i++)
      convs.push(await visitor.createConversation({ pageUrl: "http://localhost:3000/" }, META));
    const first = convs[0];
    if (!first) throw new Error("no conversation");
    await visitor.handoff(
      {
        conversationId: first.conversationId,
        trigger: "explicit_request",
        name: "Alex",
        email: "alex@example.com",
        consent: true,
        noticeVersion: "2026-10",
      },
      first.visitorToken,
    );
    const insights = await admin.insights(7);
    expect(insights.conversations).toBe(4);
    expect(insights.handoffs).toBe(1);
    expect(insights.handoffRate).toBe(0.25);
  });
});

describe("D1 prompt budget", () => {
  const chunk = (id: string, words: number): MatchedChunk => ({
    chunkId: id,
    documentId: id,
    title: id,
    url: null,
    type: "faq",
    source: "faq",
    externalId: id,
    heading: id,
    content: Array.from({ length: words }, (_, i) => `word${i}`).join(" "),
    meta: {},
    rrfScore: 1,
    similarity: null,
    ftsRank: 1,
  });

  it("cuts an oversized first chunk instead of keeping it whole, and keeps the total", () => {
    const kept = trimToBudget([chunk("huge", 5000), chunk("a", 100), chunk("b", 100)], 2400);
    expect(kept.map((c) => c.chunkId)).toEqual(["huge", "a", "b"]);
    for (const c of kept)
      expect(estimateTokens(c.content)).toBeLessThanOrEqual(PROMPT_BUDGET.chunkTokens);
    const total = kept.reduce((n, c) => n + estimateTokens(`${c.heading}\n${c.content}`), 0);
    expect(total).toBeLessThanOrEqual(2400);
  });

  it("skips a chunk that would overflow and still fits a smaller one after it", () => {
    const kept = trimToBudget(
      [
        chunk("a", 300),
        chunk("b", 300),
        chunk("c", 300),
        chunk("d", 300),
        chunk("e", 300),
        chunk("f", 20),
      ],
      1500,
    );
    expect(kept.at(-1)?.chunkId).toBe("f");
  });

  it("splits a long FAQ answer into capped chunks", () => {
    const long = Array.from({ length: 700 }, (_, i) => `w${i}`).join(" ");
    const parts = chunksFor({
      ...entry("faq-long", "Long FAQ", long),
      source: "faq",
      chunks: [{ heading: "Long FAQ", content: long }],
    });
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.content.split(" ").length).toBeLessThanOrEqual(300);
  });

  it("never sends more than 8,000 tokens, however long the history", () => {
    const big = Array.from({ length: 1500 }, () => "context").join(" ");
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 ? ("assistant" as const) : ("user" as const),
      content: big,
    }));
    const messages = assemblePrompt(history, {
      pagePath: "/",
      pageTitle: null,
      teamOnline: false,
      now: new Date(),
      confident: true,
      sources: [chunk("a", 300), chunk("b", 300), chunk("c", 300)],
      question: "What do you do?",
    });
    expect(estimatePromptTokens(SYSTEM_PROMPT, messages)).toBeLessThanOrEqual(PROMPT_BUDGET.total);
    expect(messages.at(-1)?.content).toContain("[1] a");
  });

  it("stores the prompt estimate per answer and tags harness traffic as test usage", async () => {
    const t = await setup();
    await t.ask("What solutions do you have?");
    await t.settle();
    const ai = (await t.store.listMessages(t.created.conversationId)).find(
      (m) => m.senderType === "ai",
    );
    expect(typeof ai?.meta.prompt_tokens_est).toBe("number");
    expect(ai?.meta.prompt_tokens_est as number).toBeLessThanOrEqual(PROMPT_BUDGET.total);
    const test = await t.visitor.createConversation(
      { pageUrl: "http://localhost:3000/", utm: { utm_source: "relay-eval" } },
      META,
    );
    const r = await t.visitor.chat(
      {
        conversationId: test.conversationId,
        clientMessageId: crypto.randomUUID(),
        text: "Application modernisation?",
        pageUrl: "http://localhost:3000/",
      },
      test.visitorToken,
      META,
      new AbortController().signal,
    );
    if (r.kind === "stream") await collect(r.events);
    await t.settle();
    const insights = await t.admin.insights(7);
    expect(insights.usageBySource.chat.requests).toBe(1);
    expect(insights.usageBySource.test.requests).toBe(1);
    expect(insights.turns.count).toBe(2);
    expect(insights.turns.maxTokensIn).toBeGreaterThan(0);
  });
});

describe("D2 small talk and typo tolerance", () => {
  it("recognises whole-message small talk only", () => {
    expect(smallTalkKind("Hello")).toBe("greeting");
    expect(smallTalkKind("hi there!")).toBe("greeting");
    expect(smallTalkKind("Thanks a lot, Relay")).toBe("thanks");
    expect(smallTalkKind("ok bye")).toBe("goodbye");
    expect(smallTalkKind("ok")).toBe("ack");
    expect(smallTalkKind("Hello, what does Vitalos do?")).toBeNull();
    expect(smallTalkKind("getting started")).toBeNull();
  });

  it("answers small talk without retrieval, a model call or a gap", async () => {
    const t = await setup();
    const done = await t.ask("Hello");
    await t.settle();
    expect(done?.text).toMatch(/^Hello\. I'm Relay/);
    expect(done?.lowConfidence).toBe(false);
    expect(t.inputs).toHaveLength(0);
    expect(await t.store.listGaps(new Date(0).toISOString())).toHaveLength(0);
  });

  it("corrects a misspelt word to the knowledge vocabulary", () => {
    const vocab = buildVocabulary([
      "Our solutions",
      "Six solutions describe problems",
      "modernise",
    ]);
    expect(correctSpelling("what are your soultions?", vocab)).toEqual({
      text: "what are your solutions?",
      corrections: [["soultions", "solutions"]],
    });
    expect(correctSpelling("Hello there", vocab).corrections).toEqual([]);
    expect(correctSpelling("founder", vocab).corrections).toEqual([]);
    expect(editDistance("soultions", "solutions", 2)).toBe(1);
  });

  it("retrieves the right source for a misspelt question", async () => {
    const t = await setup();
    const done = await t.ask("what are your soultions?");
    expect(done?.lowConfidence).toBe(false);
    expect(done?.citations.map((c) => c.title)).toContain("Our solutions");
  });

  it("joins a ten-word follow-up to the previous question", () => {
    expect(
      composeQuery(
        "so how can I modernise my system with this?",
        "What is the Application Modernisation offer?",
      ),
    ).toBe(
      "What is the Application Modernisation offer? so how can I modernise my system with this?",
    );
  });

  it("drafts a suggested answer from the best-matching page, never published", async () => {
    const t = await setup();
    await t.store.recordGap(
      "can you modernise legacy systems",
      "Can you modernise legacy systems?",
      null,
    );
    const gap = (await t.store.listGaps(new Date(0).toISOString()))[0];
    const out = await t.admin.suggestAnswer(gap?.id ?? "", {
      id: "sa:1",
      name: "Temitope Agbola",
      initials: "TA",
      email: "t@vitalos.co.uk",
      role: "SuperAdmin",
    });
    const doc = await t.store.getDocument(out.documentId);
    expect(doc?.status).toBe("draft");
    expect(doc?.source).toBe("team_answer");
    expect(doc?.bodyMd).toContain("controlled stages");
  });
});

describe("D3 staff names", () => {
  it("shows visitors a first name only, never a username or email", () => {
    expect(publicStaffName("Temitope Agbola")).toBe("Temitope");
    expect(publicStaffName("temitope.agbola")).toBe("Vitalos team");
    expect(publicStaffName("someone@vitalos.co.uk")).toBe("Vitalos team");
    expect(publicStaffName("TEMITOPE")).toBe("Temitope");
    expect(publicStaffName("")).toBe("Vitalos team");
    expect(publicStaffName("Vitalos team")).toBe("Vitalos team");
  });
});

describe("D4 sync status and Overview", () => {
  it("reports the last sync per source and flags a stale one", async () => {
    let now = new Date("2026-10-17T10:00:00Z");
    const t = await setup(() => now);
    const run = await t.store.startSyncRun("cms", "full");
    await t.store.finishSyncRun({ ...run, finishedAt: now.toISOString() });
    now = new Date("2026-10-18T17:00:00Z");
    const overview = await t.admin.overview();
    expect(overview.sync.cms.ageHours).toBe(31);
    expect(overview.sync.cms.stale).toBe(true);
    expect(overview.sync.repo.lastSyncAt).toBeNull();
    expect(overview.awaitingConfirmation).toBe(1);
    expect(overview).toHaveProperty("gapsThisWeek");
    expect(overview).toHaveProperty("waitingNow", 0);
  });

  it("records a sync run per bundled source on the hourly ingest", async () => {
    const t = memoryContext();
    const admin = new AdminService(t.ctx, {
      bundledEntries: () =>
        Promise.resolve([
          entry("a", "A", "Alpha text."),
          entry("b", "B", "Beta text.", { source: "cms", sourceRef: "cms:b" }),
        ]),
      faq: FAQ_STATUS,
    });
    const result = await admin.ingestBundled("relay:cron");
    expect(result.repo.added).toBe(1);
    expect(result.cms.added).toBe(1);
    const again = await admin.ingestBundled("relay:cron");
    expect(again.repo.added + again.repo.updated).toBe(0);
    expect((await t.store.lastSyncRuns("repo", 5)).length).toBe(2);
  });
});

describe("D5 next opening", () => {
  const settings = parseStoredSettings({});
  it("is the next weekday start in London time", () => {
    // Friday 17 Oct 2026, 18:00 BST -> Monday 09:00 BST (08:00 UTC).
    expect(nextOpening(settings, new Date("2026-10-17T17:00:00Z"))).toEqual({
      at: "2026-10-19T08:00:00.000Z",
      label: "Monday 09:00",
    });
    // Tuesday 07:00 BST -> today 09:00.
    expect(nextOpening(settings, new Date("2026-10-20T06:00:00Z"))?.label).toBe("today 09:00");
    // Tuesday 19:00 -> tomorrow 09:00.
    expect(nextOpening(settings, new Date("2026-10-20T18:00:00Z"))?.label).toBe("tomorrow 09:00");
    // After the clocks go back (GMT): 09:00 London is 09:00 UTC.
    expect(nextOpening(settings, new Date("2026-10-30T18:00:00Z"))?.at).toBe(
      "2026-11-02T09:00:00.000Z",
    );
    // Inside working hours: none.
    expect(nextOpening(settings, new Date("2026-10-20T10:00:00Z"))).toBeNull();
  });

  it("reaches the widget through suggestions settings", async () => {
    const t = await setup(() => new Date("2026-10-17T17:00:00Z"));
    const s = await t.visitor.settings();
    const team = await t.visitor.teamStatus(s);
    expect(t.visitor.widgetSettings(s, team).nextOpening?.label).toBe("Monday 09:00");
  });
});

describe("D6 thumbs-down reason", () => {
  it("stores the reason without recording the gap twice, and counts it in insights", async () => {
    const t = await setup();
    await t.ask("Do you offer quantum computing?");
    await t.settle();
    const ai = (await t.store.listMessages(t.created.conversationId)).find(
      (m) => m.senderType === "ai",
    );
    const ref = { conversationId: t.created.conversationId, messageId: ai?.id ?? "" };
    expect(await t.visitor.feedback({ ...ref, value: -1 }, t.created.visitorToken)).toEqual({
      showHandoff: true,
    });
    const gapsAfterThumb = (await t.store.listGaps(new Date(0).toISOString()))[0]?.count ?? 0;
    expect(
      await t.visitor.feedback({ ...ref, value: -1, reason: "incomplete" }, t.created.visitorToken),
    ).toEqual({ showHandoff: true });
    const stored = await t.store.getMessage(ref.messageId);
    expect(stored?.feedbackReason).toBe("incomplete");
    expect((await t.store.listGaps(new Date(0).toISOString()))[0]?.count ?? 0).toBe(gapsAfterThumb);
    expect((await t.admin.insights(7)).feedbackReasons.incomplete).toBe(1);
  });
});
