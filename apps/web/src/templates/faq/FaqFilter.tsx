"use client";

import { useEffect, useId, useState } from "react";

export interface FaqFilterLabels {
  label: string;
  /** Status line with `{shown}` and `{total}` placeholders (a server prop, so a string). */
  count: string;
  none: string;
}

/** Opens the question a link points at (`/faq#{id}`): a closed `<details>` hides its answer. */
function openFromHash(container: HTMLElement | null) {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id || !container) return;
  const target = document.getElementById(id);
  if (target instanceof HTMLDetailsElement && container.contains(target)) target.open = true;
}

/**
 * The FAQ page's filter (finding B10): progressive enhancement over the server-rendered list.
 * Without JavaScript nothing is rendered and every question shows. With it, typing hides the
 * questions (`[data-faq-entry]`) whose text does not contain every word typed, and any group
 * (`[data-faq-group]`) left empty; a polite status line says how many remain. It also opens the
 * question named in the URL fragment, so per-question links land on an open answer.
 */
export function FaqFilter({
  targetId,
  labels,
}: Readonly<{ targetId: string; labels: FaqFilterLabels }>) {
  const inputId = useId();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<{ shown: number; total: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    const container = document.getElementById(targetId);
    openFromHash(container);
    const onHash = () => openFromHash(container);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [targetId]);

  useEffect(() => {
    if (!mounted) return;
    const container = document.getElementById(targetId);
    if (!container) return;
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const entries = Array.from(container.querySelectorAll<HTMLElement>("[data-faq-entry]"));
    let shown = 0;
    for (const entry of entries) {
      const text = (entry.textContent ?? "").toLowerCase();
      const match = words.every((word) => text.includes(word));
      entry.hidden = !match;
      if (match) shown += 1;
    }
    for (const group of container.querySelectorAll<HTMLElement>("[data-faq-group]")) {
      group.hidden = group.querySelector("[data-faq-entry]:not([hidden])") === null;
    }
    setCounts(words.length > 0 ? { shown, total: entries.length } : null);
  }, [mounted, query, targetId]);

  if (!mounted) return null;
  return (
    <div role="search" className="grid max-w-(--container-content) gap-(--space-2)">
      <label htmlFor={inputId} className="text-small font-semibold text-tone-heading">
        {labels.label}
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        className="min-h-11 w-full rounded-lg border border-tone-border bg-tone-bg px-(--space-4) text-body text-tone-text focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <p role="status" aria-live="polite" className="m-0 min-h-6 text-small text-tone-muted">
        {counts
          ? counts.shown === 0
            ? labels.none
            : labels.count
                .replace("{shown}", String(counts.shown))
                .replace("{total}", String(counts.total))
          : ""}
      </p>
    </div>
  );
}
