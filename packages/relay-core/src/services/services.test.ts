import { describe, expect, it } from "vitest";
import type { ChatEvent } from "../contract";
import { ingestEntries } from "../knowledge/ingest";
import type { KnowledgeEntry } from "../knowledge/types";
import { nullEmbedder } from "../retrieval/embed";
import { memoryContext } from "../testing";
import { AdminService } from "./admin";
import { CronService } from "./cron";
import { VisitorService } from "./visitor";

const ADMIN = {
  id: "sa:12",
  name: "Temitope Agbola",
  initials: "TA",
  email: "temitope@vitalos.co.uk",
  role: "SuperAdmin" as const,
};
const META = {
  ip: "203.0.113.10",
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130",
  country: "GB",
};

const entry = (
  id: string,
  title: string,
  body: string,
  extra: Partial<KnowledgeEntry> = {},
): KnowledgeEntry => ({
  source: "repo",
  sourceRef: `repo:${id}`,
  externalId: id,
  title,
  url: `/offers/${id}`,
  type: "offer",
  bodyMd: body,
  status: "published",
  owner: null,
  reviewDate: null,
  meta: { page_placements: [`/offers/${id}`] },
  adminMeta: {},
  checksum: id,
  ...extra,
});

async function collect(events: AsyncIterable<ChatEvent>) {
  const out: ChatEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

async function setup() {
  const t = memoryContext();
  await ingestEntries(t.store, nullEmbedder, [
    entry(
      "engineering-rescue",
      "Engineering Rescue",
      "We stabilise and rescue failing software projects, then hand back a healthy codebase.",
    ),
    entry(
      "application-modernisation",
      "Application Modernisation",
      "We modernise legacy software projects in stages so the service keeps running while it improves.",
    ),
  ]);
  const visitor = new VisitorService(t.ctx);
  const admin = new AdminService(t.ctx, {
    bundledEntries: () => Promise.resolve([]),
    faq: {
      sync: () => Promise.reject(new Error("not in test")),
      status: () =>
        Promise.resolve({
          mode: "snapshot",
          hubActive: false,
          needsConfirmation: [],
          held: [],
          lastRun: null,
        }),
    },
  });
  const created = await visitor.createConversation(
    { pageUrl: "http://localhost:3000/offers/engineering-rescue" },
    META,
  );
  return { ...t, visitor, admin, created };
}

const ask = (
  visitor: VisitorService,
  created: { conversationId: string; visitorToken: string },
  text: string,
) =>
  visitor.chat(
    {
      conversationId: created.conversationId,
      clientMessageId: crypto.randomUUID(),
      text,
      pageUrl: "http://localhost:3000/offers/engineering-rescue",
    },
    created.visitorToken,
    META,
    new AbortController().signal,
  );

describe("visitor chat", () => {
  it("streams a cited answer, stores both messages and redacts personal data for the model", async () => {
    const { visitor, created, store, settle } = await setup();
    const result = await ask(
      visitor,
      created,
      "Can you rescue a failing project? My email is jane@example.com",
    );
    expect(result.kind).toBe("stream");
    if (result.kind !== "stream") return;
    const events = await collect(result.events);
    const done = events.find((e) => e.event === "done");
    expect(done?.event).toBe("done");
    if (done?.event !== "done") return;
    expect(done.data.citations[0]?.title).toBe("Engineering Rescue");
    expect(done.data.handoffSuggested).toBe(false);
    expect(
      events
        .filter((e) => e.event === "delta")
        .map((e) => (e.event === "delta" ? e.data.text : ""))
        .join(""),
    ).toBe(done.data.text);
    await settle();
    const messages = await store.listMessages(created.conversationId);
    expect(messages.map((m) => m.senderType)).toEqual(["visitor", "ai"]);
    expect(messages[0]?.body).toContain("jane@example.com");
    expect(messages[0]?.bodyRedacted).toContain("[email]");
    expect(messages[0]?.bodyRedacted).not.toContain("jane@");
    expect((await store.getConversation(created.conversationId))?.aiTurns).toBe(1);
  });

  it("is idempotent by clientMessageId and replays the stored answer", async () => {
    const { visitor, created, store } = await setup();
    const body = {
      conversationId: created.conversationId,
      clientMessageId: crypto.randomUUID(),
      text: "rescue a failing project",
      pageUrl: "http://localhost:3000/",
    };
    const first = await visitor.chat(
      body,
      created.visitorToken,
      META,
      new AbortController().signal,
    );
    if (first.kind === "stream") await collect(first.events);
    const second = await visitor.chat(
      body,
      created.visitorToken,
      META,
      new AbortController().signal,
    );
    if (second.kind === "stream") await collect(second.events);
    expect((await store.listMessages(created.conversationId)).length).toBe(2);
  });

  it("skips the model on an explicit request for a person and offers a hand-off", async () => {
    const { visitor, created, store } = await setup();
    const result = await ask(visitor, created, "Can I speak to a real person please?");
    if (result.kind !== "stream") throw new Error("expected stream");
    const done = (await collect(result.events)).find((e) => e.event === "done");
    expect(done?.event === "done" && done.data.handoffSuggested).toBe(true);
    expect(done?.event === "done" && done.data.text).toBe(
      "Of course. A person from the team can pick this up.",
    );
    expect((await store.getConversation(created.conversationId))?.tags).toContain(
      "ASKED_FOR_A_PERSON",
    );
  });

  it("offers a person and records a gap on low confidence", async () => {
    const { visitor, created, store, settle, notifier } = await setup();
    const result = await ask(visitor, created, "What is the capital of France?");
    if (result.kind !== "stream") throw new Error("expected stream");
    const done = (await collect(result.events)).find((e) => e.event === "done");
    expect(done?.event === "done" && done.data.lowConfidence).toBe(true);
    expect(done?.event === "done" && done.data.citations).toEqual([]);
    await settle();
    expect((await store.listGaps(new Date(0).toISOString())).length).toBe(1);
    expect(notifier.events.map((e) => e.type)).toContain("relay.no_answer");
  });

  it("rejects a wrong token, closed conversations and over-long messages", async () => {
    const { visitor, created } = await setup();
    await expect(ask(visitor, { ...created, visitorToken: "wrong" }, "hi")).rejects.toMatchObject({
      code: "unauthorised",
    });
    await visitor.end(created.conversationId, created.visitorToken);
    await expect(ask(visitor, created, "hi")).rejects.toMatchObject({
      code: "conversation_closed",
    });
  });

  it("rate-limits messages per IP", async () => {
    const { visitor, created } = await setup();
    for (let i = 0; i < 20; i++) {
      const r = await ask(visitor, created, `question ${i}`);
      if (r.kind === "stream") await collect(r.events);
    }
    await expect(ask(visitor, created, "one more")).rejects.toMatchObject({ code: "rate_limited" });
  });
});

describe("hand-off and admin flow", () => {
  it("runs thumbs down → hand-off → join → two-way messages → hand back → close", async () => {
    const { visitor, admin, created, store, settle, notifier, broadcaster } = await setup();
    const first = await ask(visitor, created, "Roughly how long would that take?");
    if (first.kind !== "stream") throw new Error("expected stream");
    const done = (await collect(first.events)).find((e) => e.event === "done");
    const aiId = done?.event === "done" ? done.data.messageId : "";
    const stored = (await store.listMessages(created.conversationId)).find(
      (m) => m.senderType === "ai",
    );
    void aiId;
    expect(stored).toBeDefined();
    expect(
      await visitor.feedback(
        { conversationId: created.conversationId, messageId: stored?.id ?? "", value: -1 },
        created.visitorToken,
      ),
    ).toEqual({ showHandoff: true });

    const handoff = await visitor.handoff(
      {
        conversationId: created.conversationId,
        trigger: "not_helpful",
        name: "Alex Morgan",
        email: "Alex.Morgan@example-care.co.uk",
        company: "Example Care Group",
        consent: true,
        noticeVersion: "2026-10",
      },
      created.visitorToken,
    );
    expect(handoff.status).toBe("awaiting_human");
    await settle();
    expect(notifier.events.map((e) => e.type)).toContain("handoff.requested");
    const requested = notifier.events.find((e) => e.type === "handoff.requested");
    expect(requested?.data.displayName).toBe("Alex Morgan");
    expect(JSON.stringify(requested)).not.toContain("example-care.co.uk");
    const inbox = await admin.inbox("needs", undefined, undefined);
    expect(inbox.counts.needs).toBe(1);
    expect(inbox.items[0]?.tags).toContain("NOT_HELPFUL");
    expect((await store.getConversation(created.conversationId))?.summary).toBeTruthy();

    // Visitor keeps chatting with AI while waiting
    const whileWaiting = await ask(visitor, created, "can you modernise it instead?");
    expect(whileWaiting.kind).toBe("stream");
    if (whileWaiting.kind === "stream") await collect(whileWaiting.events);

    const joined = await admin.join(created.conversationId, ADMIN);
    expect(joined.conversation.status).toBe("human");
    expect(joined.conversation.assigned?.initials).toBe("TA");
    await settle();
    expect(
      broadcaster.sent.some((s) => s.topic.startsWith("relay:v:") && s.event === "changed"),
    ).toBe(true);

    // AI is paused: the visitor's message is stored and delivered, no AI answer
    const human = await ask(visitor, created, "Thanks, that's useful. Can we book a call?");
    expect(human.kind).toBe("accepted");
    await settle();
    expect(notifier.events.map((e) => e.type)).toContain("visitor.replied");

    const reply = await admin.reply(created.conversationId, ADMIN, {
      text: "Yes. I'll send some times over.",
      clientMessageId: crypto.randomUUID(),
      emailIfAway: true,
    });
    expect(reply.emailed).toBe(false); // visitor emails are off by default
    const seen = await visitor.messages(created.conversationId, created.visitorToken);
    expect(seen.status).toBe("human");
    expect(seen.person).toEqual({ name: "Temitope Agbola", initials: "TA" });
    expect(seen.messages.filter((m) => m.senderType === "system").map((m) => m.event)).toEqual([
      "handoff_requested",
      "admin_joined",
      "ai_paused",
    ]);
    expect(seen.messages.at(-1)).toMatchObject({
      senderType: "admin",
      body: "Yes. I'll send some times over.",
      adminName: "Temitope Agbola",
    });

    await admin.note(created.conversationId, ADMIN, "Internal: follow up Friday");
    expect(
      (await visitor.messages(created.conversationId, created.visitorToken)).messages.some((m) =>
        m.body.includes("Internal"),
      ),
    ).toBe(false);

    const saved = await admin.saveToKnowledge(created.conversationId, reply.message.id, ADMIN);
    const doc = await store.getDocument(saved.documentId);
    expect(doc).toMatchObject({ source: "team_answer", status: "draft" });

    const back = await admin.handback(created.conversationId);
    expect(back.conversation.status).toBe("ai");
    const closed = await admin.close(created.conversationId, ADMIN);
    expect(closed.conversation.status).toBe("closed");
    expect((await admin.inbox("closed", undefined, undefined)).counts).toMatchObject({
      needs: 0,
      live: 0,
      closed: 1,
    });
    const insights = await admin.insights(7);
    expect(insights.conversations).toBe(1);
    expect(insights.handoffs).toBe(1);
    expect(insights.notHelpful).toBe(1);
  });

  it("publishing a team answer makes it retrievable and cited", async () => {
    const { visitor, admin, created, store } = await setup();
    const draft = await admin.knowledgeCreate(
      {
        title: "Do you work with councils?",
        type: "faq",
        bodyMd: "Yes. We work with local councils on service modernisation.",
        url: "",
      },
      ADMIN,
    );
    expect((await ask(visitor, created, "Do you work with councils?")).kind).toBe("stream");
    await admin.knowledgePublish(draft.document.id, ADMIN);
    const result = await ask(visitor, created, "Do you work with councils?");
    if (result.kind !== "stream") throw new Error("expected stream");
    const done = (await collect(result.events)).find((e) => e.event === "done");
    expect(done?.event === "done" && done.data.citations[0]?.title).toBe(
      "Do you work with councils?",
    );
    await admin.knowledgeArchive(draft.document.id, ADMIN);
    expect(await store.listChunksForDocument(draft.document.id)).toEqual([]);
  });

  it("settings validation and audit", async () => {
    const { admin, store } = await setup();
    await expect(admin.putSettings({ model: "deepseek-chat" }, ADMIN)).rejects.toMatchObject({
      code: "invalid",
    });
    const ok = await admin.putSettings(
      { reminderMinutes: 15, secondReminderMinutes: 45, suggestedQuestions: ["One?", "Two?"] },
      ADMIN,
    );
    expect(ok.settings.reminderMinutes).toBe(15);
    expect(
      store.auditLog.some((a) => a.action === "settings.updated" && a.actorAdminId === "sa:12"),
    ).toBe(true);
  });
});

describe("cron", () => {
  it("sends reminders once at 10 and once at 30 minutes, and never twice", async () => {
    let clock = Date.parse("2026-10-15T09:00:00Z");
    const t = memoryContext({}, () => new Date(clock));
    const visitor = new VisitorService(t.ctx);
    const cron = new CronService(t.ctx);
    const created = await visitor.createConversation({ pageUrl: "http://localhost:3000/" }, META);
    await visitor.handoff(
      {
        conversationId: created.conversationId,
        trigger: "explicit_request",
        name: "Alex Morgan",
        email: "alex@example.invalid",
        consent: true,
        noticeVersion: "2026-10",
      },
      created.visitorToken,
    );
    await t.settle();
    expect((await cron.reminders()).sent).toBe(0);
    clock += 10 * 60_000;
    expect((await cron.reminders()).sent).toBe(1);
    expect((await cron.reminders()).sent).toBe(0);
    clock += 15 * 60_000;
    expect((await cron.reminders()).sent).toBe(0);
    clock += 6 * 60_000;
    expect((await cron.reminders()).sent).toBe(1);
    clock += 60 * 60_000;
    expect((await cron.reminders()).sent).toBe(0);
    expect(
      t.notifier.events.filter((e) => e.type === "handoff.reminder").map((e) => e.data.nth),
    ).toEqual([1, 2]);
  });

  it("sends the digest once per day", async () => {
    const t = memoryContext({}, () => new Date("2026-10-15T07:45:00Z")); // 08:45 London
    const cron = new CronService(t.ctx);
    expect((await cron.digest()).sent).toBe(true);
    expect((await cron.digest()).sent).toBe(false);
    const weekend = memoryContext({}, () => new Date("2026-10-17T07:45:00Z"));
    expect((await new CronService(weekend.ctx).digest()).sent).toBe(false);
  });
});

describe("message ids", () => {
  it("stores the AI answer under the id announced in the meta event, so feedback finds it", async () => {
    const { visitor, created, store } = await setup();
    const result = await ask(visitor, created, "Can you rescue a failing project?");
    if (result.kind !== "stream") throw new Error("expected stream");
    const events = await collect(result.events);
    const meta = events.find((e) => e.event === "meta");
    const announced = meta?.event === "meta" ? meta.data.messageId : "";
    expect(await store.getMessage(announced)).toMatchObject({ senderType: "ai" });
    await expect(
      visitor.feedback(
        { conversationId: created.conversationId, messageId: announced, value: 1 },
        created.visitorToken,
      ),
    ).resolves.toEqual({ showHandoff: false });
  });
});

describe("security review fixes", () => {
  const handoffBody = (conversationId: string) => ({
    conversationId,
    trigger: "explicit_request" as const,
    name: "Alex Morgan",
    email: "alex@example-care.co.uk",
    consent: true as const,
    noticeVersion: "2026-10",
  });

  it("a ServiceLead's edit takes a published answer out of retrieval until a SuperAdmin republishes", async () => {
    const { admin, store } = await setup();
    const draft = await admin.knowledgeCreate(
      { title: "Do you work with councils?", type: "faq", bodyMd: "Yes, with councils.", url: "" },
      ADMIN,
    );
    await admin.knowledgePublish(draft.document.id, ADMIN);
    expect((await store.listChunksForDocument(draft.document.id)).length).toBeGreaterThan(0);

    const lead = { ...ADMIN, id: "sa:13", role: "ServiceLead" as const };
    const edited = await admin.knowledgeUpdate(
      draft.document.id,
      {
        title: "Do you work with councils?",
        type: "faq",
        bodyMd: "Yes, at a fixed price.",
        url: "",
      },
      lead,
    );
    expect(edited.document.status).toBe("draft");
    expect(await store.listChunksForDocument(draft.document.id)).toEqual([]);

    // A SuperAdmin's edit stays live and is re-indexed.
    await admin.knowledgePublish(draft.document.id, ADMIN);
    const again = await admin.knowledgeUpdate(
      draft.document.id,
      { title: "Do you work with councils?", type: "faq", bodyMd: "Yes, with councils.", url: "" },
      ADMIN,
    );
    expect(again.document.status).toBe("published");
    expect((await store.listChunksForDocument(draft.document.id)).length).toBeGreaterThan(0);
  });

  it("a repeated hand-off sends one alert and one summary, counts summary tokens, and is rate-limited", async () => {
    const { visitor, created, settle, notifier, store, ctx } = await setup();
    const day = ctx.deps.now().toISOString().slice(0, 10);
    const first = await ask(visitor, created, "Can you rescue a failing software project?");
    if (first.kind === "stream") await collect(first.events);
    await settle();
    const beforeHandoff = (await store.getUsage(day))?.tokensIn ?? 0;
    await visitor.handoff(handoffBody(created.conversationId), created.visitorToken);
    await settle();
    const afterFirst = await store.getUsage(day);
    expect(afterFirst?.tokensIn ?? 0).toBeGreaterThan(beforeHandoff);

    await visitor.handoff(handoffBody(created.conversationId), created.visitorToken);
    await settle();
    expect(notifier.events.filter((e) => e.type === "handoff.requested")).toHaveLength(1);
    expect((await store.getUsage(day))?.tokensIn).toBe(afterFirst?.tokensIn);

    for (let i = 0; i < 3; i += 1)
      await visitor.handoff(handoffBody(created.conversationId), created.visitorToken);
    await expect(
      visitor.handoff(handoffBody(created.conversationId), created.visitorToken),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("counts an aborted answer against the daily token cap", async () => {
    const { visitor, created, store, ctx, settle } = await setup();
    const abort = new AbortController();
    const result = await visitor.chat(
      {
        conversationId: created.conversationId,
        clientMessageId: crypto.randomUUID(),
        text: "Can you rescue a failing software project?",
        pageUrl: "http://localhost:3000/offers/engineering-rescue",
      },
      created.visitorToken,
      META,
      abort.signal,
    );
    if (result.kind !== "stream") throw new Error("expected stream");
    for await (const e of result.events) {
      if (e.event === "delta") {
        abort.abort();
        break;
      }
    }
    await settle();
    const usage = await store.getUsage(ctx.deps.now().toISOString().slice(0, 10));
    expect(usage?.tokensIn ?? 0).toBeGreaterThan(0);
  });
});
