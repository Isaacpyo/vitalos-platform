"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { COPY, LIMITS, isSafeSiteLink } from "@vitalos/relay-core/contract";
import type {
  Citation,
  ConversationStatus,
  HandoffTrigger,
  NextStep,
  TeamStatus,
  VisitorMessage,
} from "@vitalos/relay-core/contract";
import "./panel.css";
import { api, RelayApiError, streamChat } from "./api";
import { Icon, StopSquare } from "./icons";
import { Markdown } from "./markdown";
import { RealtimeChannel } from "./realtime";
import { clearConversation, loadConversation, saveConversation } from "./storage";
import type { StoredConversation } from "./storage";
import { getTurnstileToken } from "./turnstile";

export interface PanelProps {
  open: boolean;
  onClose: (returnFocus: boolean) => void;
  onUnread: (count: number) => void;
  turnstileSiteKey?: string | undefined;
  symbolSrc: string;
  privacyUrl: string;
}

// ---------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------
interface UiMessage extends VisitorMessage {
  clientId?: string;
  pending?: boolean;
  streaming?: boolean;
  failed?: boolean;
  noted?: boolean;
}

type Notice =
  | { kind: "sendFailed"; retryText: string }
  | { kind: "unavailable" }
  | { kind: "rateLimited" }
  | { kind: "tooLong" }
  | { kind: "deleted" };

interface HandoffForm {
  open: boolean;
  trigger: HandoffTrigger;
  name: string;
  email: string;
  company: string;
  consent: boolean;
  errors: Partial<Record<"name" | "email" | "consent" | "form", string>>;
  submitting: boolean;
}

interface State {
  conv: StoredConversation | null;
  messages: UiMessage[];
  status: ConversationStatus;
  person: { name: string; initials: string } | null;
  team: TeamStatus;
  suggestions: string[];
  noticeVersion: string;
  outOfHoursText: string;
  contact: { name: string; email: string } | null;
  /** Reference for the team, from the server once a person is involved. */
  caseId: string | null;
  notice: Notice | null;
  handoff: HandoffForm;
  personTyping: string | null;
  streaming: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "What does an AI Opportunity Assessment involve?",
  "Can you take over a struggling software project?",
  "How does an engagement with Vitalos start?",
  "Which sectors do you work in?",
];
/** The welcome shows three suggestions, each with its own glyph and tint. */
const SUGGESTION_ICONS = [
  { icon: "document", tone: "cobalt" },
  { icon: "gear", tone: "mineral" },
  { icon: "people", tone: "cobalt" },
] as const;

const initial: State = {
  conv: null,
  messages: [],
  status: "ai",
  person: null,
  team: "offline",
  suggestions: DEFAULT_SUGGESTIONS,
  noticeVersion: "2026-10",
  outOfHoursText: "The team is offline right now. We'll reply by email on the next working day.",
  contact: null,
  caseId: null,
  notice: null,
  handoff: {
    open: false,
    trigger: "explicit_request",
    name: "",
    email: "",
    company: "",
    consent: false,
    errors: {},
    submitting: false,
  },
  personTyping: null,
  streaming: false,
};

type Action =
  | { type: "patch"; patch: Partial<State> }
  | { type: "messages"; messages: UiMessage[] }
  | { type: "merge"; messages: VisitorMessage[] }
  | { type: "add"; message: UiMessage }
  | { type: "update"; id: string; patch: Partial<UiMessage> }
  | { type: "delta"; id: string; text: string }
  | { type: "handoff"; patch: Partial<HandoffForm> }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "messages":
      return { ...state, messages: action.messages };
    case "merge": {
      // Server messages replace optimistic ones (by id) and append new ones, oldest first.
      const byId = new Map(state.messages.map((m) => [m.id, m]));
      for (const m of action.messages)
        byId.set(m.id, {
          ...byId.get(m.id),
          ...m,
          pending: false,
          streaming: false,
          failed: false,
        });
      const merged = [...byId.values()].filter(
        (m) =>
          !(
            m.pending &&
            action.messages.some((s) => s.senderType === "visitor" && s.body === m.body)
          ),
      );
      merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { ...state, messages: merged };
    }
    case "add":
      return { ...state, messages: [...state.messages, action.message] };
    case "update":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id || m.clientId === action.id ? { ...m, ...action.patch } : m,
        ),
      };
    case "delta":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, body: m.body + action.text } : m,
        ),
      };
    case "handoff":
      return { ...state, handoff: { ...state.handoff, ...action.patch } };
    case "reset":
      return {
        ...initial,
        suggestions: state.suggestions,
        team: state.team,
        noticeVersion: state.noticeVersion,
      };
  }
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
type Mode = "desktop" | "tablet" | "mobile";

function useMode(): Mode {
  const get = (): Mode =>
    typeof window === "undefined"
      ? "desktop"
      : window.matchMedia("(min-width: 1024px)").matches
        ? "desktop"
        : window.matchMedia("(min-width: 640px)").matches
          ? "tablet"
          : "mobile";
  const [mode, setMode] = useState<Mode>(get);
  useEffect(() => {
    const update = () => setMode(get());
    const a = window.matchMedia("(min-width: 1024px)");
    const b = window.matchMedia("(min-width: 640px)");
    a.addEventListener("change", update);
    b.addEventListener("change", update);
    return () => {
      a.removeEventListener("change", update);
      b.removeEventListener("change", update);
    };
  }, []);
  return mode;
}

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const label = same
    ? "Today"
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(d);
  return `${label} · ${time(iso)}`.toUpperCase();
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function pagePath(): string {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

// ---------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------
export function Panel(props: PanelProps) {
  const [state, dispatch] = useReducer(reducer, initial);
  const mode = useMode();
  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingRef = useRef(0);
  const stickRef = useRef(true);
  const unreadRef = useRef(0);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showNewPill, setShowNewPill] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [realtimeUp, setRealtimeUp] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const stateRef = useRef(state);
  stateRef.current = state;

  const persist = useCallback((conv: StoredConversation | null) => {
    if (conv) saveConversation(conv);
    dispatch({ type: "patch", patch: { conv } });
  }, []);

  // --- Bootstrap: stored conversation, resume link, welcome data -----------------------------
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const resumeToken = params.get("relay") === "resume" ? params.get("t") : null;
    void (async () => {
      if (resumeToken) {
        params.delete("relay");
        params.delete("t");
        const q = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`,
        );
        try {
          const res = await api.resume(resumeToken);
          const conv: StoredConversation = {
            conversationId: res.conversationId,
            visitorToken: res.visitorToken,
            channelKey: res.channelKey,
            realtime: res.realtime,
            lastSeenAt: new Date().toISOString(),
            personJoined: true,
          };
          saveConversation(conv);
        } catch {
          // An expired or used link simply opens a fresh panel.
        }
      }
      const stored = loadConversation();
      if (stored && !cancelled) {
        dispatch({ type: "patch", patch: { conv: stored } });
        await refresh(stored, true);
      }
    })();
    api
      .suggestions(pagePath())
      .then((s) => {
        if (cancelled) return;
        dispatch({
          type: "patch",
          patch: {
            suggestions: s.questions.length ? s.questions : DEFAULT_SUGGESTIONS,
            team: s.teamStatus,
            noticeVersion: s.noticeVersion,
            outOfHoursText: s.outOfHoursText,
          },
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /** Fetches messages (all, or newer than the last known) and the conversation status. */
  const refresh = useCallback(
    async (conv: StoredConversation, full = false) => {
      try {
        const known = stateRef.current.messages.filter((m) => !m.pending && !m.streaming);
        const after = full ? undefined : known.at(-1)?.createdAt;
        const res = await api.messages(conv.conversationId, conv.visitorToken, after);
        dispatch(
          full
            ? { type: "messages", messages: res.messages }
            : { type: "merge", messages: res.messages },
        );
        const personJoined = conv.personJoined || res.status === "human";
        if (personJoined !== conv.personJoined)
          persist({ ...conv, personJoined, lastSeenAt: new Date().toISOString() });
        dispatch({
          type: "patch",
          patch: {
            status: res.status,
            person: res.person,
            team: res.teamStatus,
            contact: res.contact,
            caseId: res.caseId,
          },
        });
        if (!stateRef.current.handoff.name && res.contact)
          dispatch({
            type: "handoff",
            patch: { name: res.contact.name, email: res.contact.email },
          });
        const newFromTeam = res.messages.filter(
          (m) => m.senderType === "admin" && (!conv.readUntil || m.createdAt > conv.readUntil),
        ).length;
        if (newFromTeam > 0) {
          unreadRef.current += full ? 0 : newFromTeam;
          props.onUnread(unreadRef.current);
        }
      } catch (error) {
        if (
          error instanceof RelayApiError &&
          (error.code === "unauthorised" || error.code === "not_found")
        ) {
          clearConversation();
          dispatch({ type: "reset" });
        }
      }
    },
    [persist, props],
  );

  // --- Realtime pings with polling fallback (ADR-038) ----------------------------------------
  const watching =
    state.conv &&
    (state.status === "awaiting_human" || state.status === "human" || state.conv.personJoined);
  useEffect(() => {
    const conv = state.conv;
    if (!conv || !watching) return;
    if (conv.realtime && !channelRef.current) {
      channelRef.current = new RealtimeChannel(
        conv.realtime,
        (ping) => {
          if (ping.event === "typing") {
            dispatch({ type: "patch", patch: { personTyping: ping.payload.name ?? "The team" } });
            setTimeout(() => dispatch({ type: "patch", patch: { personTyping: null } }), 6000);
          } else {
            void refresh(conv);
          }
        },
        setRealtimeUp,
      );
      channelRef.current.open();
    }
    const interval = props.open ? 4000 : 20_000;
    const pollEvery = realtimeUp ? Math.max(interval, 30_000) : interval;
    const timer = setInterval(() => void refresh(conv), pollEvery);
    return () => clearInterval(timer);
  }, [state.conv, watching, props.open, realtimeUp, refresh]);

  useEffect(() => () => channelRef.current?.close(), []);

  // --- Turnstile: start when the panel opens so a token is ready before the first message ------
  const turnstileRef2 = useRef<{ token: Promise<string | undefined>; at: number } | null>(null);
  const prefetchTurnstile = useCallback(() => {
    if (!props.turnstileSiteKey || !turnstileRef.current) return;
    turnstileRef2.current = {
      token: getTurnstileToken(props.turnstileSiteKey, turnstileRef.current),
      at: Date.now(),
    };
  }, [props.turnstileSiteKey]);
  /** A token is single use and lasts five minutes: take the prefetched one if it is fresh. */
  const takeTurnstileToken = useCallback(async (): Promise<string | undefined> => {
    if (!props.turnstileSiteKey) return undefined;
    const ready = turnstileRef2.current;
    turnstileRef2.current = null;
    if (ready && Date.now() - ready.at < 240_000) return ready.token;
    if (!turnstileRef.current) return undefined;
    return getTurnstileToken(props.turnstileSiteKey, turnstileRef.current);
  }, [props.turnstileSiteKey]);
  useEffect(() => {
    if (props.open && !stateRef.current.conv && !turnstileRef2.current) prefetchTurnstile();
  }, [props.open, prefetchTurnstile]);

  // --- Open/close behaviour: focus, Esc, scroll lock, keyboard, unread ------------------------
  useEffect(() => {
    if (!props.open) return;
    unreadRef.current = 0;
    props.onUnread(0);
    const conv = stateRef.current.conv;
    if (conv)
      persist({
        ...conv,
        readUntil: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      });
    const id = requestAnimationFrame(() => composerRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [props.open]);

  useEffect(() => {
    if (!props.open || mode !== "mobile") return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const vv = window.visualViewport;
    const fit = () =>
      panelRef.current?.style.setProperty("--relay-vh", `${vv ? vv.height : window.innerHeight}px`);
    fit();
    vv?.addEventListener("resize", fit);
    return () => {
      root.style.overflow = prev;
      vv?.removeEventListener("resize", fit);
    };
  }, [props.open, mode]);

  const modal = mode !== "desktop";
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (menuOpen) setMenuOpen(false);
      else props.onClose(true);
      return;
    }
    if (e.key === "Tab" && modal && panelRef.current) {
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea, input, [tabindex='0']",
        ),
      ].filter((el) => el.offsetParent !== null);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // --- Scrolling: follow new content unless the visitor scrolled up ---------------------------
  const onScroll = () => {
    const el = logRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (stickRef.current) setShowNewPill(false);
  };
  useLayoutEffect(() => {
    const el = logRef.current;
    if (!el) return;
    // The welcome screen starts at its heading: in the shorter floating panel it can overflow.
    if (state.messages.length === 0 && !state.handoff.open) {
      el.scrollTop = 0;
      return;
    }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
    else setShowNewPill(true);
  }, [state.messages, state.handoff.open, state.personTyping]);

  // --- Conversation lifecycle ------------------------------------------------------------------
  const ensureConversation = useCallback(async (): Promise<StoredConversation> => {
    const existing = stateRef.current.conv;
    if (existing) return existing;
    const turnstileToken = await takeTurnstileToken();
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const [k, v] of params) if (/^utm_[a-z]{1,20}$/.test(k)) utm[k] = v.slice(0, 200);
    const res = await api.createConversation({
      ...(turnstileToken ? { turnstileToken } : {}),
      pageUrl: window.location.origin + window.location.pathname,
      pageTitle: document.title.slice(0, 200),
      ...(document.referrer ? { referrer: document.referrer.slice(0, 500) } : {}),
      ...(Object.keys(utm).length ? { utm } : {}),
    });
    const conv: StoredConversation = {
      conversationId: res.conversationId,
      visitorToken: res.visitorToken,
      channelKey: res.channelKey,
      realtime: res.realtime,
      lastSeenAt: new Date().toISOString(),
      readUntil: new Date().toISOString(),
    };
    persist(conv);
    dispatch({
      type: "patch",
      patch: {
        team: res.settings.teamStatus,
        noticeVersion: res.settings.noticeVersion,
        outOfHoursText: res.settings.outOfHoursText,
      },
    });
    return conv;
  }, [persist, takeTurnstileToken]);

  const showNotice = (error: unknown, retryText: string) => {
    const code = error instanceof RelayApiError ? error.code : "network";
    const notice: Notice =
      code === "rate_limited"
        ? { kind: "rateLimited" }
        : code === "too_long"
          ? { kind: "tooLong" }
          : code === "unavailable"
            ? { kind: "unavailable" }
            : { kind: "sendFailed", retryText };
    dispatch({ type: "patch", patch: { notice } });
  };

  const send = useCallback(
    async (raw: string) => {
      const body = raw.trim();
      if (!body || stateRef.current.streaming) return;
      if (body.length > LIMITS.messageMaxChars) {
        dispatch({ type: "patch", patch: { notice: { kind: "tooLong" } } });
        return;
      }
      if (stateRef.current.status === "closed") {
        clearConversation();
        dispatch({ type: "reset" });
        stateRef.current = { ...stateRef.current, conv: null, status: "ai", messages: [] };
      }
      dispatch({ type: "patch", patch: { notice: null } });
      setText("");
      stickRef.current = true;
      const clientId = crypto.randomUUID();
      const now = new Date().toISOString();
      dispatch({
        type: "add",
        message: {
          id: clientId,
          clientId,
          senderType: "visitor",
          body,
          createdAt: now,
          pending: true,
        },
      });

      let conv: StoredConversation;
      try {
        conv = await ensureConversation();
      } catch (error) {
        dispatch({ type: "update", id: clientId, patch: { failed: true, pending: false } });
        showNotice(error, body);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      let aiId: string | null = null;
      dispatch({ type: "patch", patch: { streaming: true } });
      try {
        const outcome = await streamChat(
          {
            conversationId: conv.conversationId,
            clientMessageId: clientId,
            text: body,
            pageUrl: window.location.origin + window.location.pathname,
          },
          conv.visitorToken,
          (event) => {
            if (event.event === "meta") {
              dispatch({
                type: "update",
                id: clientId,
                patch: { id: event.data.visitorMessageId, pending: false },
              });
              aiId = event.data.messageId;
              dispatch({
                type: "add",
                message: {
                  id: aiId,
                  senderType: "ai",
                  body: "",
                  createdAt: new Date().toISOString(),
                  streaming: true,
                  citations: [],
                },
              });
            } else if (event.event === "delta" && aiId) {
              dispatch({ type: "delta", id: aiId, text: event.data.text });
            } else if (event.event === "done" && aiId) {
              dispatch({
                type: "update",
                id: aiId,
                patch: {
                  body: event.data.text,
                  streaming: false,
                  citations: event.data.citations,
                  nextStep: event.data.nextStep,
                  handoffSuggested: event.data.handoffSuggested,
                  lowConfidence: event.data.lowConfidence,
                },
              });
              setAnnounce(`Relay replied: ${event.data.text.replace(/\[\d\]/g, "").slice(0, 300)}`);
            } else if (event.event === "error") {
              if (aiId)
                dispatch({
                  type: "messages",
                  messages: stateRef.current.messages.filter((m) => m.id !== aiId || m.body),
                });
              if (aiId) dispatch({ type: "update", id: aiId, patch: { streaming: false } });
              dispatch({
                type: "patch",
                patch: {
                  notice:
                    event.data.code === "rate_limited"
                      ? { kind: "rateLimited" }
                      : { kind: "unavailable" },
                },
              });
            }
          },
          controller.signal,
        );
        if (outcome.kind === "accepted") {
          dispatch({ type: "update", id: clientId, patch: { pending: false } });
          void refresh(conv);
        }
      } catch (error) {
        dispatch({ type: "update", id: clientId, patch: { failed: true, pending: false } });
        if (error instanceof RelayApiError && error.code === "conversation_closed") {
          clearConversation();
          dispatch({ type: "reset" });
        } else {
          showNotice(error, body);
        }
      } finally {
        if (controller.signal.aborted && aiId)
          dispatch({ type: "update", id: aiId, patch: { streaming: false, truncated: true } });
        abortRef.current = null;
        dispatch({ type: "patch", patch: { streaming: false } });
      }
    },
    [ensureConversation, refresh],
  );

  const stop = () => abortRef.current?.abort();

  const openHandoff = useCallback((trigger: HandoffTrigger) => {
    dispatch({ type: "handoff", patch: { open: true, trigger, errors: {} } });
    stickRef.current = true;
  }, []);

  // Move focus to the first field once the card is on screen (after the commit, not before).
  useEffect(() => {
    if (!state.handoff.open) return;
    const t = setTimeout(
      () => panelRef.current?.querySelector<HTMLInputElement>("#relay-handoff-name")?.focus(),
      0,
    );
    return () => clearTimeout(t);
  }, [state.handoff.open]);

  const submitHandoff = async (e: FormEvent) => {
    e.preventDefault();
    const f = stateRef.current.handoff;
    const errors: HandoffForm["errors"] = {};
    if (!f.name.trim()) errors.name = "Enter your name";
    if (!EMAIL.test(f.email.trim())) errors.email = "Enter a valid email address";
    if (!f.consent) errors.consent = "Tick the box so we can contact you about this enquiry";
    if (Object.keys(errors).length) {
      dispatch({ type: "handoff", patch: { errors } });
      const first = errors.name ? "name" : errors.email ? "email" : "consent";
      panelRef.current?.querySelector<HTMLElement>(`#relay-handoff-${first}`)?.focus();
      return;
    }
    dispatch({ type: "handoff", patch: { submitting: true, errors: {} } });
    try {
      const conv = await ensureConversation();
      const res = await api.handoff(
        {
          conversationId: conv.conversationId,
          trigger: f.trigger,
          name: f.name.trim(),
          email: f.email.trim(),
          ...(f.company.trim() ? { company: f.company.trim() } : {}),
          consent: true,
          noticeVersion: stateRef.current.noticeVersion,
        },
        conv.visitorToken,
      );
      dispatch({ type: "handoff", patch: { open: false, submitting: false } });
      dispatch({
        type: "patch",
        patch: {
          status: res.status,
          team: res.teamStatus,
          contact: { name: f.name.trim(), email: f.email.trim() },
          caseId: res.caseId,
        },
      });
      persist({ ...conv, personJoined: true });
      await refresh(conv);
      setAnnounce("Request sent. The team has been told.");
    } catch (error) {
      dispatch({
        type: "handoff",
        patch: {
          submitting: false,
          errors: { form: error instanceof RelayApiError ? error.message : COPY.sendFailed },
        },
      });
    }
  };

  const feedback = async (m: UiMessage, value: 1 | -1) => {
    const conv = stateRef.current.conv;
    if (!conv) return;
    dispatch({ type: "update", id: m.id, patch: { feedback: value, noted: true } });
    try {
      const res = await api.feedback(conv.conversationId, m.id, value, conv.visitorToken);
      if (res.showHandoff && stateRef.current.status === "ai") openHandoff("not_helpful");
    } catch {
      dispatch({ type: "update", id: m.id, patch: { noted: false } });
    }
  };

  const onType = (value: string) => {
    setText(value);
    const s = stateRef.current;
    if (
      s.conv &&
      (s.status === "human" || s.status === "awaiting_human") &&
      Date.now() - lastTypingRef.current > 3000
    ) {
      lastTypingRef.current = Date.now();
      void api.typing(s.conv.conversationId, s.conv.visitorToken);
    }
  };

  const newConversation = () => {
    setMenuOpen(false);
    channelRef.current?.close();
    channelRef.current = null;
    clearConversation();
    dispatch({ type: "reset" });
    composerRef.current?.focus();
  };

  const deleteConversation = async () => {
    const conv = stateRef.current.conv;
    setConfirmDelete(false);
    setMenuOpen(false);
    if (conv) {
      try {
        await api.remove(conv.conversationId, conv.visitorToken);
      } catch {
        // Deleting locally still clears the device; the server copy expires under retention.
      }
    }
    channelRef.current?.close();
    channelRef.current = null;
    clearConversation();
    dispatch({ type: "reset" });
    dispatch({ type: "patch", patch: { notice: { kind: "deleted" } } });
  };

  const endChat = async () => {
    const conv = stateRef.current.conv;
    if (!conv) return;
    try {
      await api.end(conv.conversationId, conv.visitorToken);
      await refresh(conv);
    } catch {
      dispatch({ type: "patch", patch: { notice: { kind: "sendFailed", retryText: "" } } });
    }
  };

  const copyAnswer = async (m: UiMessage) => {
    try {
      await navigator.clipboard.writeText(m.body.replace(/\[\d\]/g, ""));
      setAnnounce("Answer copied.");
    } catch {
      // Clipboard can be blocked; nothing else to do.
    }
  };

  const copyCaseId = async (caseId: string) => {
    try {
      await navigator.clipboard.writeText(caseId);
      setAnnounce("Case ID copied.");
    } catch {
      // Clipboard can be blocked; the ID is on screen to read out or type.
    }
  };

  // --- Derived view state ----------------------------------------------------------------------
  const human = state.status === "human" && state.person;
  const welcome = state.messages.length === 0 && !state.handoff.open;
  const placeholder = human
    ? `Message ${firstName(state.person?.name ?? "")}`
    : welcome
      ? "Ask about your project"
      : "Reply to Relay";

  const items = useMemo(() => {
    const out: ReactNode[] = [];
    let lastDay = "";
    for (const m of state.messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        out.push(<Divider key={`day-${m.id}`}>{dayLabel(m.createdAt)}</Divider>);
        lastDay = day;
      }
      out.push(
        <MessageView
          key={m.id}
          m={m}
          contactEmail={state.contact?.email ?? null}
          caseId={state.caseId}
          outOfHoursText={state.outOfHoursText}
          onCopyCaseId={(id) => void copyCaseId(id)}
          onFeedback={(msg, value) => void feedback(msg, value)}
          onCopy={(msg) => void copyAnswer(msg)}
          onTalk={() => openHandoff("low_confidence")}
          onNextStepHandoff={() => openHandoff("explicit_request")}
        />,
      );
    }
    return out;
  }, [state.messages, state.contact, state.outOfHoursText]);

  return (
    <>
      {props.open && modal && mode === "tablet" && (
        <div className="relay-scrim" onClick={() => props.onClose(true)} aria-hidden="true" />
      )}
      <div
        ref={panelRef}
        id="relay-panel"
        className={`relay-panel relay-panel--${mode}${props.open ? " relay-panel--open" : ""}`}
        {...(modal ? { role: "dialog", "aria-modal": true } : { role: "region" })}
        aria-labelledby={titleId}
        hidden={!props.open}
        onKeyDown={onKeyDown}
      >
        <header className="relay-header">
          {human && state.person ? (
            <span className="relay-avatar" aria-hidden="true">
              {state.person.initials}
            </span>
          ) : (
            <span className="relay-header-symbol" aria-hidden="true">
              <img src={props.symbolSrc} alt="" width={32} height={32} />
            </span>
          )}
          <div className="relay-header-text">
            <h2 id={titleId} className="relay-title">
              {human && state.person ? state.person.name : "Relay"}
              <span className="relay-visually-hidden"> chat</span>
            </h2>
            <p className="relay-subtitle">
              <span className="relay-status-dot" aria-hidden="true" />
              {/* Team status shows only once a person has joined (owner direction, 17 Oct 2026). */}
              {human ? (
                <>
                  <span className="relay-online">Team online</span>
                  <span className="relay-subtitle-sep" aria-hidden="true">
                    ·
                  </span>
                  A person, not AI
                </>
              ) : (
                "AI assistant"
              )}
            </p>
          </div>
          <div className="relay-header-actions">
            <button
              type="button"
              className="relay-icon-button"
              aria-label="Conversation options"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name="more" />
            </button>
            <button
              type="button"
              className="relay-icon-button"
              aria-label="Close chat"
              onClick={() => props.onClose(true)}
            >
              <Icon name="close" />
            </button>
          </div>
          {menuOpen && (
            <div className="relay-menu" role="menu">
              <button type="button" role="menuitem" onClick={newConversation}>
                Start a new conversation
              </button>
              {!human && state.status !== "closed" && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    openHandoff("explicit_request");
                  }}
                >
                  Talk to a person
                </button>
              )}
              {!confirmDelete ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setConfirmDelete(true)}
                  disabled={!state.conv}
                >
                  Delete this conversation
                </button>
              ) : (
                <div className="relay-menu-confirm">
                  <p>Delete this conversation for good?</p>
                  <button
                    type="button"
                    className="relay-button relay-button--small"
                    onClick={() => void deleteConversation()}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="relay-text-button"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep it
                  </button>
                </div>
              )}
              <a role="menuitem" href={props.privacyUrl}>
                Privacy notice
              </a>
            </div>
          )}
        </header>
        {state.caseId && (
          <p className="relay-case-strip" data-testid="relay-case-strip">
            <span className="relay-mono">Case ID</span>
            <span className="relay-case-id-value">{state.caseId}</span>
          </p>
        )}

        <div ref={logRef} className="relay-body" onScroll={onScroll}>
          {welcome && (
            <>
              <section className="relay-hero" aria-label="Welcome">
                <h3 className="relay-hero-title">
                  Ask Vitalos<span className="relay-stop">.</span>
                </h3>
              </section>
              <section className="relay-start" aria-label="Suggested questions">
                <ul className="relay-start-list">
                  {state.suggestions.slice(0, SUGGESTION_ICONS.length).map((q, i) => {
                    const look = SUGGESTION_ICONS[i] ?? SUGGESTION_ICONS[0];
                    return (
                      <li key={q}>
                        <button
                          type="button"
                          className="relay-start-row"
                          onClick={() => void send(q)}
                        >
                          <span
                            className={`relay-start-icon relay-start-icon--${look.tone}`}
                            aria-hidden="true"
                          >
                            <Icon name={look.icon} size={24} />
                          </span>
                          <span className="relay-start-question">{q}</span>
                          <Icon name="chevron" size={20} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          {!welcome && (
            <div className="relay-log" role="log" aria-live="off" aria-label="Conversation">
              {items}
              {state.personTyping && (
                <div className="relay-typing relay-typing--person">
                  <span className="relay-dot relay-dot--person" aria-hidden="true" />
                  <span className="relay-mono">
                    {`${firstName(state.personTyping)} IS TYPING`.toUpperCase()}
                  </span>
                  <span
                    className="relay-typing-squares relay-typing-squares--person"
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}
              {state.handoff.open && (
                <HandoffCard
                  form={state.handoff}
                  privacyUrl={props.privacyUrl}
                  onChange={(patch) => dispatch({ type: "handoff", patch })}
                  onSubmit={(e) => void submitHandoff(e)}
                  onCancel={() => dispatch({ type: "handoff", patch: { open: false } })}
                />
              )}
            </div>
          )}
          {showNewPill && (
            <button
              type="button"
              className="relay-new-pill"
              onClick={() => {
                stickRef.current = true;
                logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
                setShowNewPill(false);
              }}
            >
              New messages
            </button>
          )}
        </div>

        <footer className="relay-composer-area">
          {state.notice && (
            <NoticeView
              notice={state.notice}
              onRetry={(t) => void send(t)}
              onTalk={() => openHandoff("explicit_request")}
              onDismiss={() => dispatch({ type: "patch", patch: { notice: null } })}
            />
          )}
          {state.status === "closed" ? (
            <button
              type="button"
              className="relay-button relay-button--block"
              onClick={newConversation}
            >
              Start a new conversation
            </button>
          ) : (
            <form
              className="relay-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <label htmlFor="relay-composer-input" className="relay-visually-hidden">
                Message Relay
              </label>
              <span className="relay-composer-icon" aria-hidden="true">
                <Icon name="chat" size={22} />
              </span>
              <textarea
                id="relay-composer-input"
                ref={composerRef}
                className="relay-input"
                rows={1}
                value={text}
                maxLength={LIMITS.messageMaxChars + 200}
                placeholder={placeholder}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
              />
              {state.streaming ? (
                <button
                  type="button"
                  className="relay-stop-button"
                  aria-label="Stop generating"
                  onClick={stop}
                >
                  <StopSquare />
                </button>
              ) : (
                <button
                  type="submit"
                  className="relay-send"
                  aria-label="Send message"
                  disabled={!text.trim()}
                >
                  <Icon name="send" />
                </button>
              )}
            </form>
          )}
          {text.length >= LIMITS.messageCounterFrom && (
            <p
              className={`relay-counter${text.length > LIMITS.messageMaxChars ? " relay-counter--over" : ""}`}
              aria-live="polite"
            >
              {text.length.toLocaleString("en-GB")} /{" "}
              {LIMITS.messageMaxChars.toLocaleString("en-GB")}
            </p>
          )}
          <div className="relay-caption">
            <p>
              {human
                ? "You're chatting with a person from Vitalos. "
                : mode === "mobile" || welcome
                  ? "Relay is AI and can make mistakes. "
                  : "Relay is AI and can make mistakes. Don't share sensitive personal data. "}
              <a href={props.privacyUrl} className="relay-link">
                Privacy
              </a>
            </p>
            {human ? (
              <button
                type="button"
                className="relay-text-button relay-text-button--ink"
                onClick={() => void endChat()}
              >
                End chat
              </button>
            ) : state.status !== "closed" && !welcome ? (
              <button
                type="button"
                className="relay-text-button relay-text-button--person"
                onClick={() => openHandoff("explicit_request")}
              >
                Talk to a person
              </button>
            ) : null}
          </div>
          <div ref={turnstileRef} className="relay-turnstile" />
        </footer>
        <div className="relay-visually-hidden" aria-live="polite" role="status">
          {announce}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------
function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="relay-divider" role="separator">
      <span className="relay-mono">{children}</span>
    </div>
  );
}

const TYPE_LABEL: Record<Citation["type"], string> = {
  OFFER: "OFFER",
  SOLUTION: "SOLUTION",
  PRACTICE: "PRACTICE",
  INDUSTRY: "INDUSTRY",
  PAGE: "PAGE",
  GUIDE: "GUIDE",
  FAQ: "FAQ",
};

function MessageView(props: {
  m: UiMessage;
  contactEmail: string | null;
  caseId: string | null;
  outOfHoursText: string;
  onCopyCaseId: (caseId: string) => void;
  onFeedback: (m: UiMessage, v: 1 | -1) => void;
  onCopy: (m: UiMessage) => void;
  onTalk: () => void;
  onNextStepHandoff: () => void;
}) {
  const { m } = props;
  if (m.senderType === "visitor") {
    return (
      <div className={`relay-visitor${m.failed ? " relay-visitor--failed" : ""}`}>
        <div className="relay-visitor-bubble">{m.body}</div>
        <p className="relay-mono relay-meta-right">
          {m.pending ? "SENDING" : m.failed ? "NOT SENT" : `YOU · ${time(m.createdAt)}`}
        </p>
      </div>
    );
  }
  if (m.senderType === "system") {
    switch (m.event) {
      case "handoff_requested":
        return (
          <div className="relay-request-sent">
            <span className="relay-ring" aria-hidden="true" />
            <div>
              <p className="relay-mono relay-mineral">REQUEST SENT · {time(m.createdAt)}</p>
              <p>
                {m.meta?.outOfHours
                  ? `${props.outOfHoursText}${(m.meta?.email ?? props.contactEmail) ? ` We'll write to ${m.meta?.email ?? props.contactEmail}.` : ""}`
                  : `We've let the team know. We'll reply here, or by email to ${m.meta?.email ?? props.contactEmail ?? "you"} if you leave.`}
              </p>
              {(m.meta?.caseId ?? props.caseId) && (
                <CaseIdRow
                  caseId={m.meta?.caseId ?? props.caseId ?? ""}
                  onCopy={props.onCopyCaseId}
                />
              )}
            </div>
          </div>
        );
      case "admin_joined":
        return (
          <Divider>{`${(m.meta?.name ?? "A person from Vitalos").toUpperCase()} JOINED · ${time(m.createdAt)}`}</Divider>
        );
      case "ai_paused":
        return (
          <p className="relay-mono relay-system-line">
            RELAY AI IS PAUSED WHILE YOU CHAT WITH THE TEAM
          </p>
        );
      case "ai_back":
        return <Divider>RELAY AI IS BACK</Divider>;
      case "closed":
        return (
          <>
            <Divider>{`CONVERSATION CLOSED · ${time(m.createdAt)}`}</Divider>
            {/* A review of the whole conversation (owner direction, 16 Oct 2026). */}
            <div className="relay-feedback relay-closing-review">
              <span className="relay-feedback-label">Was this conversation helpful?</span>
              <button
                type="button"
                className="relay-feedback-button"
                aria-label="Conversation was helpful"
                aria-pressed={m.feedback === 1}
                onClick={() => props.onFeedback(m, 1)}
              >
                <Icon name="thumbUp" size={18} />
              </button>
              <button
                type="button"
                className="relay-feedback-button"
                aria-label="Conversation was not helpful"
                aria-pressed={m.feedback === -1}
                onClick={() => props.onFeedback(m, -1)}
              >
                <Icon name="thumbDown" size={18} />
              </button>
              {(m.noted || m.feedback) && <span className="relay-mono relay-muted">THANK YOU</span>}
            </div>
          </>
        );
      default:
        return null;
    }
  }
  const person = m.senderType === "admin";
  const anchor = (n: number) =>
    m.citations?.some((c) => c.n === n) ? `#relay-src-${m.id}-${n}` : null;
  return (
    <article className="relay-answer" aria-busy={m.streaming ? true : undefined}>
      <p className="relay-meta">
        <span className={`relay-dot${person ? " relay-dot--person" : ""}`} aria-hidden="true" />
        <span className="relay-mono relay-meta-who">
          {person ? `${(m.adminName ?? "Vitalos").toUpperCase()} · VITALOS` : "RELAY · AI"}
        </span>
        {m.streaming ? (
          <>
            <span className="relay-mono relay-meta-time">WRITING</span>
            <span className="relay-typing-squares" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </>
        ) : (
          <span className="relay-mono relay-meta-time">{time(m.createdAt)}</span>
        )}
      </p>
      <div className="relay-answer-body">
        {m.body ? <Markdown text={m.body} sourceAnchor={anchor} /> : null}
        {m.streaming && <span className="relay-caret" aria-hidden="true" />}
        {m.truncated && !m.streaming && <p className="relay-mono relay-muted">STOPPED</p>}
      </div>
      {!person && !m.streaming && (
        <>
          {m.citations && m.citations.length > 0 && (
            <Sources messageId={m.id} citations={m.citations} />
          )}
          {m.nextStep && <NextStepRow step={m.nextStep} onHandoff={props.onNextStepHandoff} />}
          {m.lowConfidence && (
            <button type="button" className="relay-person-button" onClick={props.onTalk}>
              <span className="relay-ring" aria-hidden="true" />
              Talk to a person
            </button>
          )}
          {!m.lowConfidence && m.handoffSuggested && (
            <button type="button" className="relay-person-button" onClick={props.onTalk}>
              <span className="relay-ring" aria-hidden="true" />
              Talk to a person
            </button>
          )}
          <div className="relay-feedback">
            <span className="relay-feedback-label">Was this helpful?</span>
            <button
              type="button"
              className="relay-feedback-button"
              aria-label="Helpful"
              aria-pressed={m.feedback === 1}
              onClick={() => props.onFeedback(m, 1)}
            >
              <Icon name="thumbUp" size={18} />
            </button>
            <button
              type="button"
              className="relay-feedback-button"
              aria-label="Not helpful"
              aria-pressed={m.feedback === -1}
              onClick={() => props.onFeedback(m, -1)}
            >
              <Icon name="thumbDown" size={18} />
            </button>
            {m.noted && <span className="relay-mono relay-muted">NOTED</span>}
            <button
              type="button"
              className="relay-copy-button"
              aria-label="Copy answer"
              onClick={() => props.onCopy(m)}
            >
              <Icon name="copy" size={18} />
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function Sources({ messageId, citations }: { messageId: string; citations: Citation[] }) {
  return (
    <div className="relay-sources">
      <p className="relay-mono">SOURCES</p>
      <ol className="relay-source-list">
        {citations.map((c) => (
          <li key={c.n} id={`relay-src-${messageId}-${c.n}`}>
            {isSafeSiteLink(c.url) ? (
              <a className="relay-source" href={c.url}>
                <span className="relay-mono relay-source-index">
                  {String(c.n).padStart(2, "0")}
                </span>
                <span className="relay-source-title">{c.title}</span>
                <span className="relay-mono relay-source-type">{TYPE_LABEL[c.type]}</span>
              </a>
            ) : (
              <span className="relay-source">
                <span className="relay-mono relay-source-index">
                  {String(c.n).padStart(2, "0")}
                </span>
                <span className="relay-source-title relay-source-title--plain">{c.title}</span>
                <span className="relay-mono relay-source-type">{TYPE_LABEL[c.type]}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The reference to quote if the visitor contacts the team another way. */
function CaseIdRow({ caseId, onCopy }: { caseId: string; onCopy: (caseId: string) => void }) {
  return (
    <p className="relay-case-row" data-testid="relay-case-row">
      <span className="relay-mono">Case ID</span>
      <span className="relay-case-id-value">{caseId}</span>
      <button
        type="button"
        className="relay-text-button relay-text-button--ink"
        aria-label={`Copy case ID ${caseId}`}
        onClick={() => onCopy(caseId)}
      >
        Copy
      </button>
      <span className="relay-case-hint">Quote it if you contact us about this chat.</span>
    </p>
  );
}

function NextStepRow({ step, onHandoff }: { step: NextStep; onHandoff: () => void }) {
  if (step.kind === "link" && !isSafeSiteLink(step.href)) return null;
  return (
    <div className="relay-next-step">
      <p className="relay-mono">NEXT STEP</p>
      {step.kind === "link" ? (
        <a className="relay-arrow-link" href={step.href}>
          {step.label}
          <Icon name="arrow" size={16} />
        </a>
      ) : (
        <button type="button" className="relay-arrow-link" onClick={onHandoff}>
          {step.label}
          <Icon name="arrow" size={16} />
        </button>
      )}
    </div>
  );
}

function NoticeView(props: {
  notice: Notice;
  onRetry: (text: string) => void;
  onTalk: () => void;
  onDismiss: () => void;
}) {
  const { notice } = props;
  const text =
    notice.kind === "sendFailed"
      ? COPY.sendFailed
      : notice.kind === "unavailable"
        ? COPY.unavailable
        : notice.kind === "rateLimited"
          ? COPY.rateLimited
          : notice.kind === "tooLong"
            ? COPY.tooLong
            : COPY.deleted;
  return (
    <div className="relay-notice" role="alert">
      <p>{text}</p>
      {notice.kind === "sendFailed" && notice.retryText && (
        <button
          type="button"
          className="relay-text-button relay-text-button--ink"
          onClick={() => props.onRetry(notice.retryText)}
        >
          Retry
        </button>
      )}
      {notice.kind === "unavailable" && (
        <button
          type="button"
          className="relay-text-button relay-text-button--person"
          onClick={props.onTalk}
        >
          Talk to a person
        </button>
      )}
      <button
        type="button"
        className="relay-icon-button relay-icon-button--small"
        aria-label="Dismiss"
        onClick={props.onDismiss}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

function HandoffCard(props: {
  form: HandoffForm;
  privacyUrl: string;
  onChange: (patch: Partial<HandoffForm>) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  const { form } = props;
  const err = (k: "name" | "email" | "consent") =>
    form.errors[k]
      ? { "aria-invalid": true as const, "aria-describedby": `relay-handoff-${k}-error` }
      : {};
  return (
    <section className="relay-handoff" aria-labelledby="relay-handoff-title">
      <p className="relay-mono relay-mineral relay-handoff-eyebrow">
        <span className="relay-ring" aria-hidden="true" />
        TALK TO A PERSON
      </p>
      <h3 id="relay-handoff-title" className="relay-handoff-title">
        {form.trigger === "not_helpful" ? "Sorry that didn't answer it" : "Talk to a person"}
        <span className="relay-stop">.</span>
      </h3>
      <p className="relay-handoff-text">
        A Vitalos specialist can pick this up here, with this conversation in front of them. Leave
        your details so we can reply by email if you step away.
      </p>
      <form className="relay-handoff-form" onSubmit={props.onSubmit} noValidate>
        <div className="relay-field">
          <label htmlFor="relay-handoff-name">Name</label>
          <input
            id="relay-handoff-name"
            className="relay-field-input"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => props.onChange({ name: e.target.value })}
            {...err("name")}
          />
          {form.errors.name && (
            <p id="relay-handoff-name-error" className="relay-field-error">
              {form.errors.name}
            </p>
          )}
        </div>
        <div className="relay-field">
          <label htmlFor="relay-handoff-email">Work email</label>
          <input
            id="relay-handoff-email"
            className="relay-field-input"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => props.onChange({ email: e.target.value })}
            {...err("email")}
          />
          {form.errors.email && (
            <p id="relay-handoff-email-error" className="relay-field-error">
              {form.errors.email}
            </p>
          )}
        </div>
        <div className="relay-field">
          <label htmlFor="relay-handoff-company">
            Company <span className="relay-muted">(optional)</span>
          </label>
          <input
            id="relay-handoff-company"
            className="relay-field-input"
            autoComplete="organization"
            placeholder="Organisation name"
            value={form.company}
            onChange={(e) => props.onChange({ company: e.target.value })}
          />
        </div>
        <div className="relay-consent">
          <input
            id="relay-handoff-consent"
            type="checkbox"
            checked={form.consent}
            onChange={(e) => props.onChange({ consent: e.target.checked })}
            {...err("consent")}
          />
          <label htmlFor="relay-handoff-consent">
            Vitalos may contact me about this enquiry.{" "}
            <a href={props.privacyUrl} className="relay-link">
              Privacy notice
            </a>
          </label>
        </div>
        {form.errors.consent && (
          <p id="relay-handoff-consent-error" className="relay-field-error">
            {form.errors.consent}
          </p>
        )}
        {form.errors.form && (
          <p className="relay-field-error" role="alert">
            {form.errors.form}
          </p>
        )}
        <button
          type="submit"
          className="relay-button relay-button--block"
          disabled={form.submitting}
        >
          {form.submitting ? "Connecting" : "Connect me to a person"}
        </button>
        <button
          type="button"
          className="relay-text-button relay-text-button--ink relay-handoff-cancel"
          onClick={props.onCancel}
        >
          Keep chatting with Relay
        </button>
      </form>
      <p className="relay-mono relay-handoff-footer">
        IN WORKING HOURS A PERSON USUALLY JOINS IN MINUTES. OUT OF HOURS WE REPLY BY EMAIL.
      </p>
    </section>
  );
}
