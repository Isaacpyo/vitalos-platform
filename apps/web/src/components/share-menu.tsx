"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { BrandMark, Icon } from "@vitalos/ui";
import type { BrandName } from "@vitalos/ui";
import { shareCopy, shareTargets } from "../features/content/share";

/**
 * The Share button on Insights articles and Careers roles. It opens a modal dialog (owner
 * direction, 17 Oct 2026) over a blurred backdrop: one round icon button per network, plus Copy
 * link and, where the device has one, the native share sheet. Every icon is named for assistive
 * technology and shows its name as a tooltip. The links are plain share URLs (no SDKs, scripts or
 * tracking). The native `<dialog>` traps focus, closes on Escape and returns focus to the Share
 * button; a click on the backdrop closes it too. Without JavaScript the same links are listed
 * as text in place of the button.
 */

const noSubscription = () => () => undefined;
const canCopy = () =>
  typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";
const canNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

const roundButton =
  "inline-flex size-14 items-center justify-center rounded-full border border-tone-border bg-tone-bg text-tone-heading no-underline transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:border-tone-heading hover:bg-tone-control-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus";

export interface ShareMenuProps {
  /** The page's canonical URL. */
  url: string;
  title: string;
  /** The dialog's title and accessible name, e.g. "Share this article". */
  menuLabel: string;
}

export function ShareMenu({ url, title, menuLabel }: Readonly<ShareMenuProps>) {
  const labels = shareCopy;
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [copied, setCopied] = useState(false);
  const copyReady = useSyncExternalStore(noSubscription, canCopy, () => false);
  const nativeReady = useSyncExternalStore(noSubscription, canNativeShare, () => false);
  const targets = shareTargets(url, title);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-11 items-center gap-(--space-2) rounded-full border border-tone-control-border px-(--space-5) text-body font-semibold text-tone-heading hover:bg-tone-control-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus"
      >
        {labels.share}
        <Icon name="arrow-up-right" size={16} />
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={headingId}
        // A click on the backdrop lands on the dialog element itself: close.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-tone-border bg-tone-bg p-0 text-tone-text shadow-floating backdrop:bg-midnight-950/45 backdrop:backdrop-blur-md"
      >
        <div className="p-(--space-6)">
          <div className="flex items-start justify-between gap-(--space-4)">
            <h2 id={headingId} className="m-0 text-h3 text-tone-heading">
              {menuLabel}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={labels.close}
              title={labels.close}
              className="-m-(--space-2) inline-flex size-11 shrink-0 items-center justify-center rounded-full text-tone-heading hover:bg-tone-control-bg focus-visible:outline-2 focus-visible:outline-tone-focus"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <ul className="m-0 mt-(--space-6) grid list-none grid-cols-4 justify-items-center gap-(--space-4) p-0">
            {targets.map((target) => {
              const action =
                target.key === "email" ? labels.byEmail : `${labels.on} ${target.label}`;
              const name = target.newTab ? `${action} ${labels.opensInNewTab}` : action;
              return (
                <li key={target.key}>
                  <a
                    href={target.href}
                    aria-label={name}
                    title={action}
                    className={roundButton}
                    onClick={close}
                    {...(target.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {target.key === "email" ? (
                      <Icon name="mail" size={24} />
                    ) : (
                      <BrandMark name={target.key as BrandName} size={22} />
                    )}
                  </a>
                </li>
              );
            })}
            {copyReady ? (
              <li>
                <button
                  type="button"
                  aria-label={copied ? labels.linkCopied : labels.copyLink}
                  title={labels.copyLink}
                  className={roundButton}
                  onClick={() => {
                    void navigator.clipboard.writeText(url).then(() => setCopied(true));
                  }}
                >
                  <Icon name={copied ? "check" : "link"} size={24} />
                </button>
              </li>
            ) : null}
            {nativeReady ? (
              <li>
                <button
                  type="button"
                  aria-label={labels.more}
                  title={labels.more}
                  className={roundButton}
                  onClick={() => {
                    close();
                    void navigator.share({ title, url }).catch(() => undefined);
                  }}
                >
                  <Icon name="plus" size={24} />
                </button>
              </li>
            ) : null}
          </ul>

          {/* Copy feedback for everyone: announced, and shown under the icons. */}
          <p
            aria-live="polite"
            className={
              copied ? "m-0 mt-(--space-5) text-center text-small text-tone-muted" : "sr-only"
            }
          >
            {copied ? labels.linkCopied : ""}
          </p>
        </div>
      </dialog>

      {/* Without JavaScript the button does nothing, so the share links are listed instead. */}
      <noscript>
        <ul className="m-0 mt-(--space-3) flex list-none flex-wrap gap-x-(--space-4) gap-y-(--space-2) p-0">
          {targets.map((target) => (
            <li key={target.key}>
              <a href={target.href} className="text-tone-link underline-offset-4 hover:underline">
                {target.label}
              </a>
            </li>
          ))}
        </ul>
      </noscript>
    </>
  );
}
