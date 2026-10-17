/**
 * Turn-budget eval (ADR-048, finding D1): 25 fixed questions (docs/relay/evals/turns.jsonl) from
 * the Master FAQ snapshot plus the five gap questions, asked through the real visitor service
 * with the memory store, the bundled knowledge and the mock model. Costs nothing and needs no
 * network, so it runs in CI (`turns.test.ts`) and with `pnpm relay:eval --turns`.
 *
 * For every question it checks that an expected source was retrieved and sent to the model, and
 * measures the input tokens of the model call from what the service actually sent (system prompt
 * and messages, `estimatePromptTokens`), so the number does not depend on the code under test.
 * Small talk must make no model call at all.
 *
 * Two modes: by default, repo entries awaiting confirmation stay drafts (today's behaviour: the
 * `pending` expectation applies, for the founder question a hand-off); with `approvePending` they
 * count as published (how Relay answers once the owner approves them).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VisitorService } from "@vitalos/relay-core";
import type { ChatEvent, LlmProvider, MatchedChunk, StreamAnswerInput } from "@vitalos/relay-core";
import { ingestEntries, nullEmbedder } from "@vitalos/relay-core/knowledge";
import { memoryContext } from "@vitalos/relay-core/testing";
import { allBundledEntries } from "../index";

const here = dirname(fileURLToPath(import.meta.url));

/** The per-call budget (ADR-048). Kept here so the eval also measures older code. */
export const TURN_BUDGET = 8_000;

/**
 * Input-token estimate of one model call, computed from exactly what the service sent. It matches
 * relay-core's `estimatePromptTokens` but is defined here so the eval does not depend on the
 * code it measures: max(1.33 tokens a word, 4 characters a token) per message, plus 4 framing.
 */
export function promptTokens(system: string, messages: readonly { content: string }[]): number {
  const est = (t: string) =>
    t ? Math.max(Math.ceil((t.match(/\S+/g) ?? []).length * 1.33), Math.ceil(t.length / 4)) : 0;
  return est(system) + messages.reduce((n, m) => n + est(m.content) + 4, 0);
}
export const TURNS_FILE = resolve(here, "../../../../docs/relay/evals/turns.jsonl");

export interface TurnCase {
  id: string;
  q: string;
  /** Earlier questions in the same conversation (follow-ups). */
  before?: string[];
  /** Any of: an external id (FAQ id or repo entry id), or `url:/path`. */
  expect?: string[];
  /**
   * Expectation while confirmation-pending repo entries are drafts: ids, or "handoff". With
   * "handoff" and `topic`, the case also passes when no source sent to the model mentions the
   * topic: the model then has nothing to answer from, and the system prompt makes it offer a
   * person (the mock model does not imitate that judgement).
   */
  pending?: string[] | "handoff";
  /** Regular expression (case-insensitive) for the subject of a "handoff" case. */
  topic?: string;
  smallTalk?: boolean;
}

export interface TurnResult {
  id: string;
  question: string;
  pass: boolean;
  reason: string;
  modelCalls: number;
  promptTokens: number;
  retrieved: string[];
  cited: string[];
  handoff: boolean;
  lowConfidence: boolean;
}

export function loadTurnCases(file = TURNS_FILE): TurnCase[] {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as TurnCase);
}

const keyOf = (c: Pick<MatchedChunk, "externalId" | "title">) => c.externalId ?? c.title;

function matches(expect: readonly string[], chunks: readonly MatchedChunk[]): boolean {
  return chunks.some((c) =>
    expect.some((e) =>
      e.startsWith("url:")
        ? c.url === e.slice(4) || c.meta.canonical_path === e.slice(4)
        : c.externalId === e,
    ),
  );
}

/** The retrieved chunks that were actually in the prompt (the numbered SOURCES block). */
function sentSources(input: StreamAnswerInput | undefined, matched: readonly MatchedChunk[]) {
  const last = input?.messages.at(-1)?.content ?? "";
  const block = last.split("\nSOURCES\n")[1]?.split("\nQUESTION\n")[0] ?? "";
  const titles = new Set(
    block
      .split("\n")
      .filter((l) => /^\[\d+\] /.test(l))
      .map((l) => l.replace(/^\[\d+\] /, "").replace(/ \([A-Za-z]+\)( \S+)?$/, "")),
  );
  const seen = new Set<string>();
  return matched.filter((c) => {
    if (!titles.has(c.title) || seen.has(c.chunkId)) return false;
    seen.add(c.chunkId);
    return true;
  });
}

/** Wraps a provider to record the input of every model call. */
function recording(inner: LlmProvider) {
  const calls: { tokens: number; input: StreamAnswerInput }[] = [];
  const provider: LlmProvider = {
    name: inner.name,
    streamAnswer(input) {
      calls.push({ tokens: promptTokens(input.system, input.messages), input });
      return inner.streamAnswer(input);
    },
    generateSummary: (input) => inner.generateSummary(input),
  };
  return { provider, calls };
}

async function drain(events: AsyncGenerator<ChatEvent>) {
  let done: Extract<ChatEvent, { event: "done" }>["data"] | null = null;
  for await (const ev of events) if (ev.event === "done") done = ev.data;
  return done;
}

export async function runTurnsEval(
  options: { approvePending?: boolean; cases?: TurnCase[] } = {},
): Promise<{ results: TurnResult[]; maxTokens: number; avgTokens: number; p95Tokens: number }> {
  const cases = options.cases ?? loadTurnCases();
  const { ctx, store, settle } = memoryContext({ rateLimitMultiplier: 1000 });
  const { provider, calls } = recording(ctx.deps.llm);
  ctx.deps.llm = provider;
  const { entries } = await allBundledEntries({
    requireHubActive: false,
    approvePending: options.approvePending ?? false,
  });
  await ingestEntries(store, nullEmbedder, entries);
  const visitor = new VisitorService(ctx);
  const meta = { ip: "203.0.113.7", userAgent: "relay-eval", country: "GB" };
  const pageUrl = "http://localhost:3000/";

  // What retrieval returned for each call, captured from the store (the service's own search).
  let lastMatched: MatchedChunk[] = [];
  const match = store.matchChunks.bind(store);
  store.matchChunks = async (params) => {
    lastMatched = await match(params);
    return lastMatched;
  };

  const results: TurnResult[] = [];
  for (const c of cases) {
    const conv = await visitor.createConversation(
      { pageUrl, utm: { utm_source: "relay-eval" } },
      meta,
    );
    const ask = async (text: string) => {
      const res = await visitor.chat(
        {
          conversationId: conv.conversationId,
          clientMessageId: crypto.randomUUID(),
          text,
          pageUrl,
        },
        conv.visitorToken,
        meta,
        new AbortController().signal,
      );
      return res.kind === "stream" ? drain(res.events) : null;
    };
    for (const q of c.before ?? []) await ask(q);
    const callsBefore = calls.length;
    lastMatched = [];
    const done = await ask(c.q);
    await settle();
    const own = calls.slice(callsBefore);
    const sent = own.length > 0 ? sentSources(own[0]?.input, lastMatched) : [];
    const promptTokens = own.reduce((m, x) => Math.max(m, x.tokens), 0);
    const handoff = Boolean(done?.handoffSuggested);
    const lowConfidence = Boolean(done?.lowConfidence);
    const expect = !options.approvePending && c.pending ? c.pending : (c.expect ?? []);
    let pass: boolean;
    let reason: string;
    if (c.smallTalk) {
      pass = own.length === 0 && Boolean(done?.text);
      reason = pass ? "small talk: fixed reply, no model call" : "small talk reached the model";
    } else if (expect === "handoff") {
      const topic = c.topic ? new RegExp(c.topic, "i") : null;
      const mentioned = topic ? sent.some((x) => topic.test(`${x.title} ${x.content}`)) : true;
      pass = handoff || lowConfidence || !mentioned;
      reason = pass
        ? "no published source answers it: nothing to answer from, a person is offered"
        : "a source was sent and answered without confirmation";
    } else {
      pass = !lowConfidence && matches(expect, sent);
      reason = pass
        ? "expected source retrieved and sent"
        : `expected one of ${expect.join(", ")}; got ${sent.map(keyOf).join(", ") || "nothing"}${lowConfidence ? " (low confidence)" : ""}`;
    }
    if (promptTokens > TURN_BUDGET) {
      pass = false;
      reason = `${promptTokens} input tokens is over the ${TURN_BUDGET} budget`;
    }
    results.push({
      id: c.id,
      question: c.q,
      pass,
      reason,
      modelCalls: own.length,
      promptTokens,
      retrieved: sent.map(keyOf),
      cited: (done?.citations ?? []).map((x) => x.title),
      handoff,
      lowConfidence,
    });
  }
  const measured = results.filter((r) => r.modelCalls > 0).map((r) => r.promptTokens);
  const sorted = [...measured].sort((a, b) => a - b);
  return {
    results,
    maxTokens: sorted.at(-1) ?? 0,
    avgTokens: measured.length
      ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length)
      : 0,
    p95Tokens: sorted.length
      ? (sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)] as number)
      : 0,
  };
}
