"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import "@vitalos/design-tokens/relay.css";
import "./launcher.css";
import { emitRelayEvent } from "./events";
import type { PanelProps } from "./panel";
import { hasSeen, loadConversation, markSeen, rememberOpen, wasOpen } from "./storage";

export interface RelayLauncherProps {
  /** Turnstile site key (invisible); loaded only when the panel opens. */
  turnstileSiteKey?: string | undefined;
  /** Class names that expose the panel fonts (next/font variables). */
  fontClassName?: string;
  symbolSrc: string;
  privacyUrl: string;
}

let panelModule: Promise<{ Panel: ComponentType<PanelProps> }> | null = null;
/** The panel bundle loads on first intent (hover, focus, click), never on page load. */
const loadPanel = () => (panelModule ??= import("./panel"));

/** While closed, a conversation a person joined is checked for replies (ADR-038 polling). */
const CLOSED_POLL_MS = 20_000;

/**
 * Vitalos Relay launcher (section 4.2): a fixed square speech tile, labelled "Ask Vitalos" on
 * desktop until the first open. No dependencies, no network until the visitor interacts, no
 * auto-open, no sound.
 *
 * The panel is MOUNTED ONLY WHILE OPEN (ADR-048, finding C2): it is never in the initial HTML and
 * leaves the DOM when closed, so a closed chat holds no transcript. While closed, a conversation
 * a person has joined is polled for new team replies (a count only) for the unread badge.
 */
export function RelayLauncher(props: RelayLauncherProps) {
  const [Panel, setPanel] = useState<ComponentType<PanelProps> | null>(null);
  const [open, setOpen] = useState(false);
  const [resume, setResume] = useState(false);
  const [seen, setSeen] = useState(true);
  const [unread, setUnread] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const ensurePanel = useCallback(async () => {
    const mod = await loadPanel();
    setPanel(() => mod.Panel);
  }, []);

  useEffect(() => {
    setSeen(hasSeen());
    // An emailed resume link (?relay=resume) is an explicit request to reopen the conversation;
    // so is a panel the visitor left open on the previous page in this tab session.
    const explicitResume = new URLSearchParams(window.location.search).get("relay") === "resume";
    if (explicitResume || wasOpen()) {
      setResume(explicitResume);
      void ensurePanel().then(() => {
        setOpen(true);
        emitRelayEvent("opened");
      });
    }
  }, [ensurePanel]);

  // Unread badge while closed: new team replies in a conversation a person joined.
  useEffect(() => {
    if (open) return;
    const stored = loadConversation();
    if (!stored?.personJoined) return;
    let cancelled = false;
    const check = async () => {
      try {
        const { api } = await import("./api");
        const current = loadConversation();
        if (!current || cancelled) return;
        const res = await api.messages(
          current.conversationId,
          current.visitorToken,
          current.readUntil,
        );
        if (!cancelled) setUnread(res.messages.filter((m) => m.senderType === "admin").length);
      } catch {
        // Offline or expired: the badge stays as it is.
      }
    };
    void check();
    const timer = setInterval(() => void check(), CLOSED_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open]);

  const toggle = async () => {
    if (!Panel) await ensurePanel();
    const next = !open;
    setOpen(next);
    setResume(false);
    rememberOpen(next);
    if (next) {
      markSeen();
      setSeen(true);
      setUnread(0);
      emitRelayEvent("opened");
    }
  };

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setResume(false);
    rememberOpen(false);
    // The launcher is hidden while the panel is open on small screens: focus it once it is back.
    if (returnFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  // WCAG 2.5.3 Label in Name: the accessible name starts with the visible text "Ask Vitalos".
  const label =
    unread > 0
      ? `Ask Vitalos. Open chat with Relay: ${unread} new ${unread === 1 ? "reply" : "replies"} from the Vitalos team`
      : "Ask Vitalos. Open chat with Relay, the Vitalos assistant";

  return (
    <div className={`relay-root ${props.fontClassName ?? ""}`}>
      <div className={`relay-launcher-wrap${open ? " relay-launcher-wrap--open" : ""}`}>
        <div className="relay-launcher-keyline">
          <button
            ref={buttonRef}
            type="button"
            className={`relay-launcher${seen ? "" : " relay-launcher--labelled"}`}
            aria-label={label}
            aria-expanded={open}
            {...(open && Panel ? { "aria-controls": "relay-panel" } : {})}
            onPointerEnter={() => void loadPanel()}
            onFocus={() => void loadPanel()}
            onClick={() => void toggle()}
          >
            {!seen && <span className="relay-launcher-label">Ask Vitalos</span>}
            <span className="relay-launcher-tile">
              <img src={props.symbolSrc} alt="" width={44} height={44} decoding="async" />
            </span>
          </button>
        </div>
        {unread > 0 && (
          <span className="relay-launcher-badge" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>
      {Panel && open && (
        <Panel
          open
          resume={resume}
          onClose={close}
          onUnread={() => setUnread(0)}
          turnstileSiteKey={props.turnstileSiteKey}
          symbolSrc={props.symbolSrc}
          privacyUrl={props.privacyUrl}
        />
      )}
    </div>
  );
}
