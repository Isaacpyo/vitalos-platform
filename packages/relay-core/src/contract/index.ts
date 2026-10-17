/**
 * Vitalos Relay visitor contract: the types and copy shared by the widget (browser) and the
 * visitor API (server). Browser-safe: no imports, no runtime dependencies, no secrets.
 */

export type ConversationStatus = "ai" | "awaiting_human" | "human" | "closed";
export type SenderType = "visitor" | "ai" | "admin" | "system" | "note";
export type HandoffTrigger =
  "not_helpful" | "explicit_request" | "low_confidence" | "model_flag" | "admin_initiated";
export type SourceType = "OFFER" | "SOLUTION" | "PRACTICE" | "INDUSTRY" | "PAGE" | "GUIDE" | "FAQ";
export type TeamStatus = "online" | "offline";

/** Thumbs-down reasons (finding D6), asked with one tap after "Not helpful". */
export const FEEDBACK_REASONS = ["wrong", "incomplete", "didnt_understand"] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];
export const FEEDBACK_REASON_LABELS: Record<FeedbackReason, string> = {
  wrong: "It was wrong",
  incomplete: "It was incomplete",
  didnt_understand: "It didn't understand me",
};

/**
 * When the team is next in working hours (Relay Settings, Europe/London), for "Back Monday 09:00"
 * while the team is offline. `label` is ready to show; null when no working days are set.
 */
export interface NextOpening {
  at: string;
  label: string;
}

export interface Citation {
  n: number;
  title: string;
  url: string | null;
  type: SourceType;
}

/** "NEXT STEP" under an answer whose top source is a Master FAQ entry with a linked offer. */
export type NextStep =
  { kind: "link"; label: string; href: string } | { kind: "handoff"; label: string };

export type SystemEvent =
  "handoff_requested" | "admin_joined" | "ai_paused" | "ai_back" | "closed" | "request_sent";

export interface VisitorMessage {
  id: string;
  senderType: Exclude<SenderType, "note">;
  body: string;
  createdAt: string;
  /** AI messages */
  citations?: Citation[];
  nextStep?: NextStep | null;
  handoffSuggested?: boolean;
  lowConfidence?: boolean;
  feedback?: -1 | 1 | null;
  feedbackReason?: FeedbackReason | null;
  truncated?: boolean;
  /** Admin messages */
  adminName?: string | null;
  adminInitials?: string | null;
  /** System messages: body is the event key */
  event?: SystemEvent;
  meta?: { name?: string; email?: string; outOfHours?: boolean };
}

export interface RealtimeInfo {
  url: string;
  key: string;
  channel: string;
}

export interface WidgetSettings {
  greeting: string;
  suggestedQuestions: string[];
  teamStatus: TeamStatus;
  outOfHoursText: string;
  privacyUrl: string;
  noticeVersion: string;
  aiEnabled: boolean;
  /** Next start of working hours; null while the team is online or when none is set. */
  nextOpening?: NextOpening | null;
}

export interface CreateConversationRequest {
  turnstileToken?: string;
  pageUrl: string;
  pageTitle?: string;
  referrer?: string;
  utm?: Record<string, string>;
}

export interface CreateConversationResponse {
  conversationId: string;
  visitorToken: string;
  channelKey: string;
  realtime: RealtimeInfo | null;
  settings: WidgetSettings;
}

export interface ChatRequest {
  conversationId: string;
  clientMessageId: string;
  text: string;
  pageUrl: string;
}

/** Server-Sent Events from POST /api/relay/chat. */
export type ChatEvent =
  | { event: "meta"; data: { messageId: string; visitorMessageId: string } }
  | { event: "delta"; data: { text: string } }
  | {
      event: "done";
      data: {
        messageId: string;
        text: string;
        citations: Citation[];
        nextStep: NextStep | null;
        handoffSuggested: boolean;
        lowConfidence: boolean;
        confidence: number;
      };
    }
  | { event: "error"; data: ApiError["error"] };

export interface MessagesResponse {
  messages: VisitorMessage[];
  status: ConversationStatus;
  person: { name: string; initials: string } | null;
  teamStatus: TeamStatus;
  contact: { name: string; email: string } | null;
  nextOpening?: NextOpening | null;
}

export interface FeedbackRequest {
  conversationId: string;
  messageId: string;
  value: 1 | -1;
  reason?: FeedbackReason;
}

export interface HandoffRequest {
  conversationId: string;
  trigger: HandoffTrigger;
  name: string;
  email: string;
  company?: string;
  consent: true;
  noticeVersion: string;
}

/** GET /api/relay/suggestions?page=…: the welcome screen before a conversation exists. */
export interface SuggestionsResponse extends WidgetSettings {
  questions: string[];
}

export type ErrorCode =
  | "invalid"
  | "unauthorised"
  | "forbidden"
  | "forbidden_origin"
  | "not_found"
  | "rate_limited"
  | "too_long"
  | "unavailable"
  | "turnstile_failed"
  | "conversation_closed"
  | "deleted";

export interface ApiError {
  error: { code: ErrorCode; message: string };
}

/** Visitor-facing copy (Relay boards, section 4.9). British English; no exclamation marks. */
export const COPY = {
  sendFailed: "Couldn't send. Check your connection and try again.",
  unavailable: "Relay can't answer right now. You can still talk to a person.",
  rateLimited: "You're sending messages quickly. Try again in a minute.",
  tooLong: "Keep messages under 2,000 characters.",
  deleted: "Conversation deleted.",
  explicitHandoff: "Of course. A person from the team can pick this up.",
  lowConfidenceLead: "I can't confirm that from Vitalos's published information, so I won't guess.",
  invalid: "Something in that request wasn't right. Try again.",
  unauthorised: "This conversation has expired. Start a new conversation.",
  closed: "This conversation has closed. Start a new conversation.",
} as const;

export const LIMITS = {
  messageMaxChars: 2000,
  messageCounterFrom: 1800,
  nameMaxChars: 120,
  companyMaxChars: 160,
} as const;

/**
 * Links Relay may render: same-site paths (not protocol-relative "//host" or "/\host") and
 * https://vitalos.co.uk. Shared by the server (citations, knowledge URLs) and the widget.
 */
export const SAFE_SITE_LINK =
  /^(\/(?![/\\])[^\s\\]*|https:\/\/(www\.)?vitalos\.co\.uk(\/[^\s\\]*)?)$/;
export const isSafeSiteLink = (href: string | null | undefined): href is string =>
  typeof href === "string" && href.length <= 500 && SAFE_SITE_LINK.test(href);

/** Storage keys (localStorage), versioned. */
export const STORAGE = {
  state: "vitalos.relay.v1",
  seen: "vitalos.relay.seen",
} as const;
