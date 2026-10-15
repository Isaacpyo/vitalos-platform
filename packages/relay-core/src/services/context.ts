import type { ErrorCode } from "../contract";
import type { RelayStore } from "../db/types";
import type { LlmProvider } from "../llm/provider";
import type { AdminNotifier } from "../notify/webhook";
import type { Broadcaster } from "../realtime/broadcast";
import type { Embedder } from "../retrieval/embed";

/** Relay configuration, mapped from the validated environment by the app (apps/web). */
export interface RelayConfig {
  deployEnv: "local" | "preview" | "staging" | "production";
  /** Env kill switch (RELAY_AI_ENABLED). Settings can also switch AI off. */
  aiEnabled: boolean;
  model: string;
  summaryModel: string;
  simFloor: number;
  /** Env cap (RELAY_DAILY_TOKEN_CAP); the lower of this and the Settings cap applies. */
  dailyTokenCap: number;
  tokenPepper: string;
  ipSalt: string;
  allowedOrigins: readonly string[];
  privacyNoticeVersion: string;
  privacyUrl: string;
  realtime: { url: string; publicKey: string } | null;
  publicSiteUrl: string;
  adminBaseUrl: string | null;
  turnstileRequired: boolean;
  visitorEmailsEnabled: boolean;
  faq: { requireHubActive: boolean };
}

export type HumanCheck = "passed" | "failed" | "disabled" | "unavailable";

export interface HumanVerifier {
  verify(token: string | undefined, ip: string | undefined): Promise<HumanCheck>;
}

export interface VisitorMailer {
  /** Sends (or logs) a visitor reply email; returns the provider status. */
  send(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    conversationId: string;
    inlineImages?: { contentId: string; filename: string; base64: string }[];
  }): Promise<"sent" | "logged" | "failed">;
}

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface RelayDeps {
  store: RelayStore;
  llm: LlmProvider;
  embedder: Embedder;
  broadcaster: Broadcaster;
  notifier: AdminNotifier;
  human: HumanVerifier;
  mailer: VisitorMailer;
  logger: Logger;
  now: () => Date;
  /** Runs work after the response (Next.js `after`); defaults to fire-and-forget. */
  defer: (task: () => Promise<unknown>) => void;
}

export interface RelayContext {
  config: RelayConfig;
  deps: RelayDeps;
}

const STATUS: Record<ErrorCode, number> = {
  invalid: 400,
  unauthorised: 401,
  forbidden: 403,
  forbidden_origin: 403,
  not_found: 404,
  rate_limited: 429,
  too_long: 400,
  unavailable: 503,
  turnstile_failed: 403,
  conversation_closed: 409,
  deleted: 410,
};

/** Domain error with a visitor-safe code; the route maps it to `{ error: { code, message } }`. */
export class RelayError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = "RelayError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
