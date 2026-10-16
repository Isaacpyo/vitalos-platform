"use client";

import { useEffect } from "react";

/**
 * Copy buttons for the article's code blocks (brief 5.2). They appear only after hydration and
 * only when the Clipboard API exists, so the server-rendered page is complete without them. The
 * article's other client island is the Share menu (`share-menu.tsx`).
 */

const buttonClass =
  "inline-flex min-h-(--size-button-sm) items-center border border-tone-control-border px-(--space-3) font-mono text-eyebrow tracking-widest uppercase text-tone-heading hover:bg-tone-control-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus";

const canCopy = () =>
  typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

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
