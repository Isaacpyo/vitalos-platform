"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@vitalos/ui";
import { shareCopy, shareTargets } from "../features/content/share";

/**
 * The Share button on Insights articles and Careers roles: a disclosure (`<details>`) that opens a small menu of plain share
 * links (no SDKs or third-party scripts), so it works before hydration. JavaScript adds closing on
 * Escape and on an outside click, Copy link (Clipboard API) and, where the device has one, the
 * native share sheet.
 */

const noSubscription = () => () => undefined;
const canCopy = () =>
  typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";
const canNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

const itemClass =
  "flex w-full min-h-11 items-center justify-between gap-(--space-4) rounded-lg px-(--space-3) text-left text-body text-tone-heading no-underline hover:bg-tone-control-bg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-tone-focus";

export interface ShareMenuProps {
  /** The page's canonical URL. */
  url: string;
  title: string;
  /** The menu's accessible name, e.g. "Share this article". */
  menuLabel: string;
}

export function ShareMenu({ url, title, menuLabel }: Readonly<ShareMenuProps>) {
  const labels = shareCopy;
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const copyReady = useSyncExternalStore(noSubscription, canCopy, () => false);
  const nativeReady = useSyncExternalStore(noSubscription, canNativeShare, () => false);

  useEffect(() => {
    const element = details.current;
    if (!element) return;
    const close = (focus: boolean) => {
      if (!element.open) return;
      element.open = false;
      if (focus) summary.current?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const closeMenu = () => {
    if (details.current) details.current.open = false;
  };

  return (
    <details ref={details} className="relative inline-block">
      <summary
        ref={summary}
        className="inline-flex min-h-11 cursor-pointer list-none items-center gap-(--space-2) rounded-full border border-tone-control-border px-(--space-5) text-body font-semibold text-tone-heading hover:bg-tone-control-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus [&::-webkit-details-marker]:hidden"
      >
        {labels.share}
        <Icon name="chevron-down" size={16} />
      </summary>
      <div
        role="group"
        aria-label={menuLabel}
        className="absolute bottom-full left-0 z-20 mb-(--space-2) w-64 rounded-2xl border border-tone-border bg-tone-bg p-(--space-2) shadow-floating"
      >
        <ul className="m-0 flex list-none flex-col p-0">
          {shareTargets(url, title).map((target) => (
            <li key={target.key}>
              <a
                href={target.href}
                className={itemClass}
                onClick={closeMenu}
                {...(target.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                <span>
                  {target.label}
                  {target.newTab ? <span className="sr-only"> {labels.opensInNewTab}</span> : null}
                </span>
                <Icon name={target.newTab ? "arrow-up-right" : "mail"} size={16} />
              </a>
            </li>
          ))}
          {copyReady ? (
            <li className="mt-(--space-1) border-t border-tone-border pt-(--space-1)">
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  void navigator.clipboard.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                <span aria-live="polite">{copied ? labels.linkCopied : labels.copyLink}</span>
                <Icon name={copied ? "check" : "link"} size={16} />
              </button>
            </li>
          ) : null}
          {nativeReady ? (
            <li>
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  closeMenu();
                  void navigator.share({ title, url }).catch(() => undefined);
                }}
              >
                <span>{labels.more}</span>
                <Icon name="plus" size={16} />
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    </details>
  );
}
