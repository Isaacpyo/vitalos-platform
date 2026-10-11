"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Icon } from "../../primitives/Icon";
import { hasText } from "../_internal/types";

export interface CodeBlockProps {
  /** The code, exactly as it should be copied. */
  code: string;
  /** Language label shown in the header, for example "ts". Optional. */
  language?: string | undefined;
  /** Accessible name of the scrollable code region. Defaults to "<language> code" or "Code". */
  "aria-label"?: string | undefined;
  /** Copy button text. Defaults are structural English labels. */
  copyLabel?: string | undefined;
  copiedLabel?: string | undefined;
  className?: string | undefined;
}

const COPIED_VISIBLE_MS = 2000;

/**
 * Code excerpt on a midnight surface. Client island ONLY for the copy button: the code itself is
 * server-rendered, selectable and, on narrow screens, a keyboard-focusable scroll region. The
 * copy button appears after hydration and only when the Clipboard API exists, so without
 * JavaScript the block is a plain readable `<pre>`.
 */
export function CodeBlock({
  code,
  language,
  "aria-label": ariaLabel,
  copyLabel = "Copy code",
  copiedLabel = "Copied",
  className,
}: CodeBlockProps) {
  const [canCopy, setCanCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCanCopy(
      typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function",
    );
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  if (!hasText(code)) return null;

  const copy = () => {
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPIED_VISIBLE_MS);
      },
      () => setCopied(false),
    );
  };

  const name = ariaLabel ?? (hasText(language) ? `${language} code` : "Code");
  const showHeader = hasText(language) || canCopy;

  return (
    <div
      data-tone="dark"
      className={cx("min-w-0 overflow-hidden rounded-md bg-tone-bg text-tone-text", className)}
    >
      {showHeader ? (
        <div className="flex items-center justify-between gap-(--space-3) border-b border-tone-border px-(--space-4) py-(--space-2)">
          <span className="font-mono text-small text-tone-muted">
            {hasText(language) ? language : ""}
          </span>
          {canCopy ? (
            <span className="inline-flex items-center gap-(--space-2)">
              <span role="status" className="text-small text-tone-muted">
                {copied ? copiedLabel : ""}
              </span>
              <button
                type="button"
                onClick={copy}
                className="inline-flex min-h-(--size-button-sm) items-center gap-(--space-2) rounded-sm border border-tone-control-border px-(--space-3) text-small font-semibold text-tone-heading hover:bg-tone-control-bg"
              >
                <Icon name={copied ? "check" : "plus"} size={16} />
                <span>{copyLabel}</span>
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
      <pre
        tabIndex={0}
        role="region"
        aria-label={name}
        className="m-0 overflow-x-auto p-(--space-4) font-mono text-small leading-relaxed focus-visible:-outline-offset-3"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
