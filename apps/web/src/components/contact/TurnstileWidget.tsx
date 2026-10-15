"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget. A client island used only by the contact form, and only when both
 * Turnstile keys are configured (the page decides). The script is loaded here, on demand, with
 * explicit rendering; no other page ever loads it. Turnstile adds the `cf-turnstile-response`
 * field to the surrounding form, which the server verifies (action `enquiry` is pinned there).
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * The normal and flexible widgets are at least 300px wide; at 320px the form column is narrower
 * than that and the widget would push the page sideways (WCAG 1.4.10). The compact widget is
 * 150px wide, so narrow columns get that one.
 */
const MIN_FLEXIBLE_WIDTH = 300;

interface TurnstileApi {
  render(
    container: HTMLElement,
    params: {
      sitekey: string;
      action: string;
      size: "normal" | "flexible" | "compact";
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile-missing"));
    script.onerror = () => reject(new Error("turnstile-load-failed"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = undefined; // allow a later mount to try again
    throw error;
  });
  return scriptPromise;
}

export interface TurnstileWidgetProps {
  /** Public site key (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`). */
  siteKey: string;
  /** Change this after each submission: a Turnstile token is single use. */
  resetKey?: unknown;
  /** Shown in the fallback text so a visitor who cannot complete the check has another route. */
  contactEmail?: string | undefined;
}

export function TurnstileWidget({ siteKey, resetKey, contactEmail }: TurnstileWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let api: TurnstileApi | undefined;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        api = turnstile;
        widgetId.current = turnstile.render(container.current, {
          sitekey: siteKey,
          action: "enquiry",
          size: container.current.clientWidth < MIN_FLEXIBLE_WIDTH ? "compact" : "flexible",
          "error-callback": () => setFailed(true),
          "expired-callback": () => {
            if (widgetId.current) turnstile.reset(widgetId.current);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (api && widgetId.current) api.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [siteKey]);

  useEffect(() => {
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      setFailed(false);
    }
  }, [resetKey]);

  // Keyboard focus moving into Cloudflare's cross-origin frame sends no focus event to this page,
  // and browsers ignore scroll-padding-top for it, so the widget can stop under the sticky header
  // (WCAG 2.4.11). The window does blur at that moment: bring the widget clear of the header then.
  useEffect(() => {
    const onBlur = () => {
      const el = container.current;
      if (el?.contains(document.activeElement))
        el.scrollIntoView({ block: "nearest", behavior: "instant" });
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  const alternative = contactEmail ? (
    <>
      {" "}
      You can email{" "}
      <a className="underline underline-offset-4" href={`mailto:${contactEmail}`}>
        {contactEmail}
      </a>{" "}
      instead.
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-(--space-2)">
      <p className="text-small text-tone-muted">
        This form uses a security check to keep out automated submissions.
      </p>
      <div ref={container} data-action="enquiry" className="min-h-16 max-w-full" />
      <div aria-live="polite" className="text-small">
        {failed ? (
          <p className="text-danger">
            The security check could not be completed. Reload the page and try again.
            {alternative}
          </p>
        ) : null}
      </div>
      <noscript>
        <p className="text-small text-tone-text">
          The security check needs JavaScript, so this enquiry may not be accepted without it.
          {alternative}
        </p>
      </noscript>
    </div>
  );
}
