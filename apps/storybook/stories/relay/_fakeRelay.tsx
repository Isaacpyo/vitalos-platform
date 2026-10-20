/**
 * Storybook-only fake of the Relay visitor API (docs/relay/API.md). It installs a scripted
 * `window.fetch` for `/api/relay/*`, seeds or clears the widget's browser storage, and restores
 * everything on unmount. It makes no network calls and never ships with the widget.
 */
import { useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { COPY, STORAGE } from "@vitalos/relay-core/contract";
import type {
  ChatEvent,
  Citation,
  ConversationStatus,
  ErrorCode,
  NextStep,
  SuggestionsResponse,
  TeamStatus,
  VisitorMessage,
  WidgetSettings,
} from "@vitalos/relay-core/contract";

export type ChatScript =
  | { kind: "answer"; answer: ScriptedAnswer }
  /** Streams some text, then holds the connection open until the visitor stops it. */
  | { kind: "streaming"; text: string }
  /** The answer fails after the stream has opened: an `error` event, no failed bubble. */
  | { kind: "stream-error"; code: ErrorCode; message: string };

export interface ScriptedAnswer {
  text: string;
  citations?: Citation[];
  nextStep?: NextStep | null;
  handoffSuggested?: boolean;
  lowConfidence?: boolean;
}

export interface Scenario {
  team: TeamStatus;
  /** Has the visitor opened the launcher before (drops the "Ask Vitalos" label). */
  seen?: boolean;
  /** Panel open on load (the widget reopens in the same tab session). */
  open?: boolean;
  /** A conversation already in the browser, with its server-side messages. */
  conversation?: {
    status: ConversationStatus;
    person?: { name: string; initials: string } | null;
    contact?: { name: string; email: string } | null;
    caseId?: string | null;
    messages: VisitorMessage[];
  };
  chat?: ChatScript;
}

/** A made-up case ID in the real format: Unix seconds, then five digits. */
export const STORY_CASE_ID = "179249323700172";

/** Minutes before now, as ISO time: stories stay readable ("Today") whenever they are opened. */
export const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const SETTINGS = (team: TeamStatus): WidgetSettings => ({
  greeting:
    "I'm Relay, the Vitalos AI assistant. I answer from our published knowledge and show my sources. A person from the team is one message away.",
  suggestedQuestions: [],
  teamStatus: team,
  outOfHoursText: "The team is offline right now. We'll reply by email on the next working day.",
  privacyUrl: "/legal/privacy",
  noticeVersion: "2026-10",
  aiEnabled: true,
});

export const QUESTIONS = [
  "What does an AI Opportunity Assessment involve?",
  "Can you take over a struggling software project?",
  "How does an engagement with Vitalos start?",
  "Which sectors do you work in?",
];

const str = (v: unknown) => (typeof v === "string" ? v : "");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

function sse(
  script: (emit: (e: ChatEvent) => void, aborted: () => boolean) => Promise<void>,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ChatEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`),
          );
        } catch {
          // The reader has gone away.
        }
      };
      await script(emit, () => signal.aborted);
      try {
        controller.close();
      } catch {
        // Already closed.
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream" } });
}

const words = (text: string): string[] => text.split(/(?<=\s)/);

function createFakeFetch(scenario: Scenario, realFetch: typeof fetch, lifetime: AbortSignal) {
  let status: ConversationStatus = scenario.conversation?.status ?? "ai";
  const person = scenario.conversation?.person ?? null;
  let contact = scenario.conversation?.contact ?? null;
  let caseId = scenario.conversation?.caseId ?? null;
  const messages: VisitorMessage[] = [...(scenario.conversation?.messages ?? [])];
  let serial = 0;
  const id = (prefix: string) => `${prefix}-${++serial}`;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (!url.pathname.startsWith("/api/relay/")) return realFetch(input, init);
    const path = url.pathname.slice("/api/relay".length);
    const method = (init?.method ?? "GET").toUpperCase();
    const body =
      typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const signal = init?.signal ?? lifetime;
    await wait(40, lifetime);

    if (method === "GET" && path === "/suggestions") {
      const res: SuggestionsResponse = { ...SETTINGS(scenario.team), questions: QUESTIONS };
      return json(200, res);
    }
    if (method === "POST" && path === "/conversations") {
      return json(201, {
        conversationId: "conv-story",
        visitorToken: "token-story",
        channelKey: "channel-story",
        realtime: null,
        settings: SETTINGS(scenario.team),
      });
    }
    if (method === "GET" && /^\/conversations\/[^/]+\/messages$/.test(path))
      return json(200, { messages, status, person, teamStatus: scenario.team, contact, caseId });

    if (method === "POST" && path === "/chat") {
      const chat = scenario.chat ?? {
        kind: "answer",
        answer: { text: "This is a scripted answer from the Storybook fake API." },
      };
      if (status === "awaiting_human" || status === "human")
        return new Response(null, { status: 202 });
      const visitorMessageId = id("visitor");
      const messageId = id("ai");
      messages.push({
        id: visitorMessageId,
        senderType: "visitor",
        body: str(body.text),
        createdAt: new Date().toISOString(),
      });
      return sse(async (emit, aborted) => {
        emit({ event: "meta", data: { messageId, visitorMessageId } });
        if (chat.kind === "stream-error") {
          emit({ event: "error", data: { code: chat.code, message: chat.message } });
          return;
        }
        const text = chat.kind === "streaming" ? chat.text : chat.answer.text;
        for (const chunk of words(text)) {
          if (aborted()) return;
          emit({ event: "delta", data: { text: chunk } });
          await wait(60, signal);
        }
        if (chat.kind === "streaming") {
          // Hold the stream open: the story shows the answer in progress.
          await new Promise<void>((resolve) => {
            signal.addEventListener("abort", () => resolve());
            lifetime.addEventListener("abort", () => resolve());
          });
          return;
        }
        const a = chat.answer;
        messages.push({
          id: messageId,
          senderType: "ai",
          body: a.text,
          createdAt: new Date().toISOString(),
          citations: a.citations ?? [],
          nextStep: a.nextStep ?? null,
          handoffSuggested: a.handoffSuggested ?? false,
          lowConfidence: a.lowConfidence ?? false,
        });
        emit({
          event: "done",
          data: {
            messageId,
            text: a.text,
            citations: a.citations ?? [],
            nextStep: a.nextStep ?? null,
            handoffSuggested: a.handoffSuggested ?? false,
            lowConfidence: a.lowConfidence ?? false,
            confidence: a.lowConfidence ? 0.2 : 0.9,
          },
        });
      }, signal);
    }
    if (method === "POST" && path === "/feedback") return json(200, { showHandoff: false });
    if (method === "POST" && path === "/handoff") {
      status = "awaiting_human";
      contact = { name: str(body.name), email: str(body.email) };
      caseId = caseId ?? STORY_CASE_ID;
      messages.push({
        id: id("system"),
        senderType: "system",
        body: "handoff_requested",
        event: "handoff_requested",
        createdAt: new Date().toISOString(),
        meta: { outOfHours: scenario.team === "offline", caseId },
      });
      return json(200, {
        status,
        teamStatus: scenario.team,
        outOfHours: scenario.team === "offline",
        caseId,
      });
    }
    if (method === "POST" && path === "/typing") return json(200, {});
    if (method === "POST" && /\/end$/.test(path)) {
      status = "closed";
      return json(200, {});
    }
    if (method === "DELETE") return json(200, {});
    return json(404, { error: { code: "not_found", message: "Not found." } });
  };
}

const OPEN_KEY = "vitalos.relay.open";

/** Seeds browser storage for the scenario and returns what restores the previous values. */
function seedStorage(scenario: Scenario): () => void {
  const keys = [STORAGE.state, STORAGE.seen];
  const before = keys.map((k) => [k, window.localStorage.getItem(k)] as const);
  const openBefore = window.sessionStorage.getItem(OPEN_KEY);
  for (const k of keys) window.localStorage.removeItem(k);
  window.sessionStorage.removeItem(OPEN_KEY);
  if (scenario.seen) window.localStorage.setItem(STORAGE.seen, "1");
  if (scenario.open) window.sessionStorage.setItem(OPEN_KEY, "1");
  if (scenario.conversation) {
    window.localStorage.setItem(
      STORAGE.state,
      JSON.stringify({
        conversationId: "conv-story",
        visitorToken: "token-story",
        channelKey: "channel-story",
        realtime: null,
        lastSeenAt: new Date().toISOString(),
        readUntil: new Date().toISOString(),
        personJoined: scenario.conversation.status === "human",
      }),
    );
  }
  return () => {
    for (const [k, v] of before) {
      if (v === null) window.localStorage.removeItem(k);
      else window.localStorage.setItem(k, v);
    }
    if (openBefore === null) window.sessionStorage.removeItem(OPEN_KEY);
    else window.sessionStorage.setItem(OPEN_KEY, openBefore);
  };
}

/**
 * Wraps a story: installs the fake API and storage before the widget mounts. Children render only
 * once the fake is in place, so the widget's first effect already talks to it.
 */
export function FakeRelay({ scenario, children }: { scenario: Scenario; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const realFetch = originalFetch;
    const lifetime = new AbortController();
    const restoreStorage = seedStorage(scenario);
    window.fetch = createFakeFetch(scenario, realFetch, lifetime.signal);
    setReady(true);
    return () => {
      setReady(false);
      lifetime.abort();
      window.fetch = originalFetch;
      restoreStorage();
    };
  }, [scenario]);
  if (!ready) return null;
  return <div>{children}</div>;
}

export { COPY };
