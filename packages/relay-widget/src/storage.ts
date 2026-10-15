import { STORAGE } from "@vitalos/relay-core/contract";
import type { RealtimeInfo } from "@vitalos/relay-core/contract";

/** What the browser keeps (localStorage `vitalos.relay.v1`), for 30 days after the last visit. */
export interface StoredConversation {
  conversationId: string;
  visitorToken: string;
  channelKey: string;
  realtime: RealtimeInfo | null;
  lastSeenAt: string;
  /** A person has joined at some point: keep checking for replies while the panel is closed. */
  personJoined?: boolean;
  /** Last message time the visitor has seen, for the unread badge. */
  readUntil?: string;
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Every storage access is guarded: private windows, blocked storage and previews must still work. */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function loadConversation(): StoredConversation | null {
  return safe(() => {
    const raw = window.localStorage.getItem(STORAGE.state);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredConversation>;
    if (!value.conversationId || !value.visitorToken || !value.channelKey) return null;
    if (value.lastSeenAt && Date.now() - Date.parse(value.lastSeenAt) > TTL_MS) {
      window.localStorage.removeItem(STORAGE.state);
      return null;
    }
    return value as StoredConversation;
  }, null);
}

export function saveConversation(value: StoredConversation): void {
  safe(() => window.localStorage.setItem(STORAGE.state, JSON.stringify(value)), undefined);
}

export function clearConversation(): void {
  safe(() => window.localStorage.removeItem(STORAGE.state), undefined);
}

export const hasSeen = () => safe(() => window.localStorage.getItem(STORAGE.seen) === "1", false);
export const markSeen = () => safe(() => window.localStorage.setItem(STORAGE.seen, "1"), undefined);

/** The panel reopens on the next page in the same tab session (full-page navigation, ADR-024). */
const OPEN_KEY = "vitalos.relay.open";
export const wasOpen = () => safe(() => window.sessionStorage.getItem(OPEN_KEY) === "1", false);
export const rememberOpen = (open: boolean) =>
  safe(
    () =>
      open
        ? window.sessionStorage.setItem(OPEN_KEY, "1")
        : window.sessionStorage.removeItem(OPEN_KEY),
    undefined,
  );
