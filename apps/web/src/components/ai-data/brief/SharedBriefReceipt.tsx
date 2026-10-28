"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { vercelAnalyticsSink } from "../../../features/analytics/vercel-sink";
import {
  DRAFT_STORAGE_KEY,
  SHARED_STORAGE_KEY,
  parseShared,
} from "../../../features/ai-data/brief/state";
import type { SharedBrief } from "../../../features/ai-data/brief/state";
import { CopyButton } from "@vitalos/ui/interactive";
import { Notice, ProvenanceTag, textButton } from "./parts";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const readShared = (): string | null => {
  try {
    return sessionStorage.getItem(SHARED_STORAGE_KEY);
  } catch {
    return null;
  }
};

const TRACKED_KEY = "vitalos.aid.brief.tracked.v1";

/**
 * Receipt-page island (W6). Reports the funnel's last step once per enquiry (`brief_shared` when
 * the enquiry came from the guided brief, otherwise `simple_form_submitted`), shows the brief
 * that was shared with a copy action, and clears the draft. Nothing here leaves the browser: the
 * brief text is read from this tab's sessionStorage, where the share step put it.
 */
export function SharedBriefReceipt({ reference }: Readonly<{ reference: string }>) {
  const raw = useSyncExternalStore(subscribe, readShared, () => null);
  const shared = useMemo(() => parseShared(raw), [raw]);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    try {
      const brief = parseShared(sessionStorage.getItem(SHARED_STORAGE_KEY));
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      const already = sessionStorage.getItem(TRACKED_KEY) === reference;
      if (!already) {
        if (brief) vercelAnalyticsSink.track("brief_shared", { source: brief.source });
        else vercelAnalyticsSink.track("simple_form_submitted", { route: "/ai-data/contact" });
        sessionStorage.setItem(TRACKED_KEY, reference);
      }
    } catch {
      // Storage blocked: no brief copy and no funnel event, the receipt still works.
    }
  }, [reference]);

  if (!shared) return cleared ? <Notice tone="info" title="Removed from this browser" /> : null;

  function clearCopy() {
    try {
      sessionStorage.removeItem(SHARED_STORAGE_KEY);
    } catch {
      // ignore
    }
    setCleared(true);
    for (const listener of listeners) listener();
  }

  return (
    <section
      aria-labelledby="aidb-shared-title"
      className="flex flex-col gap-(--space-4)"
      data-shared-brief
    >
      <h2 id="aidb-shared-title" className="m-0 text-h2 text-aid-heading">
        The brief you shared
      </h2>
      <div className="flex flex-wrap items-center gap-(--space-2)">
        <ProvenanceTag kind={shared.source === "ai" ? "ai" : "checklist"}>
          {shared.source === "ai"
            ? "Drafted with AI suggestions"
            : "Prepared from our checklist: no AI used"}
        </ProvenanceTag>
        <span className="text-small text-aid-muted">{shared.cardsKept} cards shared</span>
      </div>
      <pre className="m-0 whitespace-pre-wrap break-words rounded-md border border-aid-border bg-aid-surface p-(--space-4) font-sans text-small text-aid-text">
        {shared.fullText}
      </pre>
      <div className="flex flex-wrap items-center gap-(--space-3)">
        <CopyButton value={shared.fullText} label="Copy the brief" copiedLabel="Brief copied" />
        <button type="button" className={textButton} onClick={clearCopy}>
          Remove this copy from my browser
        </button>
      </div>
    </section>
  );
}
