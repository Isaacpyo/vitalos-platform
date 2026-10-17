import { COPY } from "@vitalos/relay-core/contract";
import type {
  ApiError,
  ChatEvent,
  CreateConversationRequest,
  CreateConversationResponse,
  ErrorCode,
  FeedbackReason,
  HandoffRequest,
  HandoffTrigger,
  MessagesResponse,
  SuggestionsResponse,
  TeamStatus,
} from "@vitalos/relay-core/contract";

export class RelayApiError extends Error {
  constructor(
    readonly code: ErrorCode | "network",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RelayApiError";
  }
}

const BASE = "/api/relay";

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new RelayApiError("network", COPY.sendFailed, 0);
  }
  const body = (await res.json().catch(() => null)) as (T & Partial<ApiError>) | null;
  if (!res.ok) {
    const err = body?.error;
    throw new RelayApiError(
      err?.code ?? "unavailable",
      err?.message ?? COPY.sendFailed,
      res.status,
    );
  }
  return body as T;
}

export const api = {
  createConversation: (body: CreateConversationRequest) =>
    request<CreateConversationResponse>("/conversations", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  messages: (conversationId: string, token: string, after?: string) =>
    request<MessagesResponse>(
      `/conversations/${conversationId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      { token },
    ),

  feedback: (
    conversationId: string,
    messageId: string,
    value: 1 | -1,
    token: string,
    reason?: FeedbackReason,
  ) =>
    request<{ showHandoff: boolean }>("/feedback", {
      method: "POST",
      token,
      body: JSON.stringify({ conversationId, messageId, value, ...(reason ? { reason } : {}) }),
    }),

  handoff: (body: HandoffRequest, token: string) =>
    request<{ status: "awaiting_human" | "human"; teamStatus: TeamStatus; outOfHours: boolean }>(
      "/handoff",
      {
        method: "POST",
        token,
        body: JSON.stringify(body),
      },
    ),

  typing: (conversationId: string, token: string) =>
    request<object>("/typing", {
      method: "POST",
      token,
      body: JSON.stringify({ conversationId }),
    }).catch(() => ({})),

  end: (conversationId: string, token: string) =>
    request<object>(`/conversations/${conversationId}/end`, { method: "POST", token, body: "{}" }),

  remove: (conversationId: string, token: string) =>
    request<object>(`/conversations/${conversationId}`, { method: "DELETE", token }),

  suggestions: (page: string) =>
    request<SuggestionsResponse>(`/suggestions?page=${encodeURIComponent(page)}`),

  resume: (token: string) =>
    request<CreateConversationResponse>("/resume", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
};

export type ChatOutcome = { kind: "stream" } | { kind: "accepted" };

/**
 * POST /api/relay/chat. Streams Server-Sent Events to `onEvent`; resolves `accepted` when a person
 * is handling the conversation (202, no AI answer). Aborting stops the answer server-side too.
 */
export async function streamChat(
  body: { conversationId: string; clientMessageId: string; text: string; pageUrl: string },
  token: string,
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
): Promise<ChatOutcome> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (signal.aborted) return { kind: "stream" };
    void error;
    throw new RelayApiError("network", COPY.sendFailed, 0);
  }
  if (res.status === 202) return { kind: "accepted" };
  if (!res.ok || !res.body) {
    const err = ((await res.json().catch(() => null)) as Partial<ApiError> | null)?.error;
    throw new RelayApiError(
      err?.code ?? "unavailable",
      err?.message ?? COPY.sendFailed,
      res.status,
    );
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let split = buffer.indexOf("\n\n");
      while (split >= 0) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const parsed = parseFrame(frame);
        if (parsed) onEvent(parsed);
        split = buffer.indexOf("\n\n");
      }
    }
  } catch {
    if (!signal.aborted) throw new RelayApiError("network", COPY.sendFailed, 0);
  }
  return { kind: "stream" };
}

export function parseFrame(frame: string): ChatEvent | null {
  let event = "";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) data.push(line.slice(6));
  }
  if (!event || data.length === 0) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) as unknown } as ChatEvent;
  } catch {
    return null;
  }
}

export type { HandoffTrigger };
