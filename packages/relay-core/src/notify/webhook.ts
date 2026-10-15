import { randomUUID } from "node:crypto";
import { canonicalString, sign } from "./signing";

/** Events the website sends to the Super Admin (docs/relay/API.md, webhook table). */
export type AdminEventType =
  | "handoff.requested"
  | "visitor.replied"
  | "handoff.reminder"
  | "relay.no_answer"
  | "relay.token_cap"
  | "faq.attention"
  | "digest.daily"
  | "inbox.changed";

export interface AdminEvent {
  type: AdminEventType;
  data: Record<string, unknown>;
  counts: { needs: number; live: number };
}

export interface AdminNotifier {
  send(event: AdminEvent): Promise<boolean>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Signed webhook to the Super Admin (`RELAY_SUPERADMIN_WEBHOOK_URL`). Retries twice (1 s, 4 s) on
 * network errors and 5xx. Never throws: a failed alert must not fail the visitor's request.
 * Bodies are never logged.
 */
export class WebhookAdminNotifier implements AdminNotifier {
  constructor(
    private readonly options: {
      url: string;
      secret: string;
      fetch?: typeof fetch;
      now?: () => Date;
      retryDelaysMs?: number[];
    },
  ) {}

  async send(event: AdminEvent): Promise<boolean> {
    const body = JSON.stringify({
      id: randomUUID(),
      type: event.type,
      at: new Date().toISOString(),
      counts: event.counts,
      data: event.data,
    });
    const url = new URL(this.options.url);
    const delays = this.options.retryDelaysMs ?? [1000, 4000];
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      const timestamp = String(Math.floor((this.options.now?.() ?? new Date()).getTime() / 1000));
      const signature = sign(
        this.options.secret,
        canonicalString({
          timestamp,
          method: "POST",
          pathWithQuery: url.pathname + url.search,
          adminHeader: "",
          body,
        }),
      );
      try {
        const res = await (this.options.fetch ?? fetch)(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-relay-timestamp": timestamp,
            "x-relay-signature": signature,
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) return true;
        if (res.status < 500) return false;
      } catch {
        // network error: retry
      }
      const delay = delays[attempt];
      if (delay !== undefined) await sleep(delay);
    }
    return false;
  }
}

/** Collects events (tests, environments without a Super Admin). */
export class MemoryAdminNotifier implements AdminNotifier {
  readonly events: AdminEvent[] = [];
  send(event: AdminEvent): Promise<boolean> {
    this.events.push(event);
    return Promise.resolve(true);
  }
}
