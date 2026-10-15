import type { RealtimeInfo } from "@vitalos/relay-core/contract";

export interface Ping {
  event: string;
  payload: { type?: string; name?: string; at?: number };
}

/**
 * Minimal Phoenix v1 client for Supabase Realtime Broadcast (ADR-038): join one public channel,
 * heartbeat every 25 s, reconnect with backoff. Pings carry no content; the panel fetches the real
 * data from the visitor API. Replaces supabase-js in the browser (bundle size).
 */
export class RealtimeChannel {
  private ws: WebSocket | null = null;
  private ref = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private closed = false;
  connected = false;

  constructor(
    private readonly info: RealtimeInfo,
    private readonly onPing: (ping: Ping) => void,
    private readonly onStatus: (connected: boolean) => void = () => undefined,
  ) {}

  open(): void {
    if (typeof WebSocket === "undefined") return;
    this.closed = false;
    const url = `${this.info.url.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(this.info.key)}&vsn=1.0.0`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.schedule();
      return;
    }
    this.ws = ws;
    const topic = `realtime:${this.info.channel}`;
    ws.onopen = () => {
      this.attempts = 0;
      this.send({
        topic,
        event: "phx_join",
        payload: { config: { broadcast: { self: false }, presence: { key: "" } } },
      });
      this.heartbeat = setInterval(
        () => this.send({ topic: "phoenix", event: "heartbeat", payload: {} }),
        25_000,
      );
    };
    ws.onmessage = (e) => {
      let msg: {
        topic?: string;
        event?: string;
        payload?: { status?: string; event?: string; payload?: Ping["payload"] };
      };
      try {
        msg = JSON.parse(String(e.data)) as typeof msg;
      } catch {
        return;
      }
      if (msg.topic !== topic) return;
      if (msg.event === "phx_reply" && msg.payload?.status === "ok" && !this.connected) {
        this.connected = true;
        this.onStatus(true);
      }
      if (msg.event === "broadcast" && msg.payload?.event) {
        this.onPing({ event: msg.payload.event, payload: msg.payload.payload ?? {} });
      }
    };
    ws.onclose = () => {
      this.stopHeartbeat();
      if (this.connected) {
        this.connected = false;
        this.onStatus(false);
      }
      if (!this.closed) this.schedule();
    };
    ws.onerror = () => ws.close();
  }

  private send(msg: { topic: string; event: string; payload: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify({ ...msg, ref: String(++this.ref) }));
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private schedule() {
    if (this.closed) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.attempts++);
    this.retry = setTimeout(() => this.open(), delay);
  }

  close(): void {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}
