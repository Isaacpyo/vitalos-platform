"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * The only client JavaScript on an article (brief 5.2): Copy buttons for code blocks and a Copy
 * link button. Both appear only after hydration and only when the Clipboard API exists, so the
 * server-rendered page is complete without them.
 */

const buttonClass =
  "inline-flex min-h-(--size-button-sm) items-center border border-tone-control-border px-(--space-3) font-mono text-eyebrow tracking-widest uppercase text-tone-heading hover:bg-tone-control-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus";

const canCopy = () =>
  typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

const noSubscription = () => () => undefined;

/** Adds a Copy button to every code block inside `#rootId` (the rendered article body). */
export function CodeCopyButtons({
  rootId,
  label,
  copiedLabel,
}: Readonly<{ rootId: string; label: string; copiedLabel: string }>) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || !canCopy()) return;
    const added: HTMLElement[] = [];
    for (const pre of root.querySelectorAll<HTMLPreElement>("pre.code-block")) {
      const wrapper = document.createElement("div");
      wrapper.className = "flex justify-end";
      const button = document.createElement("button");
      button.type = "button";
      button.className = buttonClass;
      button.textContent = label;
      button.setAttribute("aria-label", `${label} code`);
      button.addEventListener("click", () => {
        void navigator.clipboard.writeText(pre.innerText.replace(/\n$/, "")).then(() => {
          button.textContent = copiedLabel;
          setTimeout(() => {
            button.textContent = label;
          }, 2000);
        });
      });
      wrapper.append(button);
      pre.before(wrapper);
      added.push(wrapper);
    }
    return () => {
      for (const node of added) node.remove();
    };
  }, [rootId, label, copiedLabel]);
  return null;
}

/** Copies the article's canonical URL. Renders nothing until it can work. */
export function CopyLinkButton({
  url,
  label,
  copiedLabel,
}: Readonly<{ url: string; label: string; copiedLabel: string }>) {
  // False on the server and before hydration; the Clipboard API never appears later.
  const ready = useSyncExternalStore(noSubscription, canCopy, () => false);
  const [copied, setCopied] = useState(false);
  if (!ready) return null;
  return (
    <button
      type="button"
      className={buttonClass}
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
