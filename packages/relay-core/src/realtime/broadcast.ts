/**
 * Content-free realtime pings (ADR-034): `{ type, conversationId?, at }` only. Clients fetch the
 * real data from authorised endpoints, so a spoofed or leaked ping reveals nothing.
 */
export type VisitorPing = "changed" | "typing";
export type AdminPing = "inbox_changed" | "notification" | "typing";

export interface Broadcaster {
  visitor(channelKey: string, event: VisitorPing, extra?: { name?: string }): Promise<void>;
  admins(event: AdminPing, extra?: { conversationId?: string; by?: "visitor" }): Promise<void>;
}

export const visitorTopic = (channelKey: string) => `relay:v:${channelKey}`;
export const ADMIN_TOPIC = "relay:admins";

/** Supabase Realtime Broadcast over HTTP (server side, secret key; never blocks the request). */
export class SupabaseBroadcaster implements Broadcaster {
  constructor(private readonly options: { url: string; secretKey: string; fetch?: typeof fetch }) {}

  private async send(
    topic: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const doFetch = this.options.fetch ?? fetch;
    try {
      await doFetch(`${this.options.url.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: this.options.secretKey,
          authorization: `Bearer ${this.options.secretKey}`,
        },
        body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Pings are best effort: clients also poll.
    }
  }

  visitor(channelKey: string, event: VisitorPing, extra: { name?: string } = {}): Promise<void> {
    // Typing pings may carry the person's first name (shown as "TEMITOPE IS TYPING"); nothing else.
    return this.send(visitorTopic(channelKey), event, {
      type: event,
      at: Date.now(),
      ...(extra.name ? { name: extra.name } : {}),
    });
  }

  admins(event: AdminPing, extra: { conversationId?: string; by?: "visitor" } = {}): Promise<void> {
    return this.send(ADMIN_TOPIC, event, { type: event, at: Date.now(), ...extra });
  }
}

/** Records pings in memory (tests, browser suites without Realtime). */
export class MemoryBroadcaster implements Broadcaster {
  readonly sent: { topic: string; event: string; payload: Record<string, unknown> }[] = [];
  visitor(channelKey: string, event: VisitorPing, extra: { name?: string } = {}): Promise<void> {
    this.sent.push({ topic: visitorTopic(channelKey), event, payload: { ...extra } });
    return Promise.resolve();
  }
  admins(event: AdminPing, extra: { conversationId?: string; by?: "visitor" } = {}): Promise<void> {
    this.sent.push({ topic: ADMIN_TOPIC, event, payload: { ...extra } });
    return Promise.resolve();
  }
}
