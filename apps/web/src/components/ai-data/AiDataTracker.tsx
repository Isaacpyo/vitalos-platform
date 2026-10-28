"use client";

import type { ReactNode } from "react";
import { isWorkflowTopic } from "../../features/ai-data/workflows";
import { currentRoute, track, trackOnce } from "./track";

const ctaIds = ["explore-workflow", "try-example", "open-expanded-demo", "prepare-brief"] as const;
type CtaId = (typeof ctaIds)[number];
const isCtaId = (value: string | null): value is CtaId =>
  value !== null && (ctaIds as readonly string[]).includes(value);

/**
 * One delegated listener for the server-rendered parts of the AI & Data home page: a workflow
 * chosen in the explorer (a radio named `aid-topic`) and clicks on the Explore / Try / brief calls
 * to action (`data-aid-cta`). Only slugs and enums are sent, validated here and by the closed
 * event taxonomy; no text a visitor typed ever reaches analytics. It renders a plain `div`, so
 * the page's server HTML is unchanged.
 */
export function AiDataTracker({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      className={className}
      onChange={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.name !== "aid-topic") return;
        if (!isWorkflowTopic(target.value)) return;
        trackOnce("workflow_started", { source: "explorer", topic: target.value });
        track("explorer_topic_selected", { topic: target.value });
      }}
      onClick={(event) => {
        const target = event.target;
        const link = target instanceof Element ? target.closest("[data-aid-cta]") : null;
        const id = link?.getAttribute("data-aid-cta") ?? null;
        if (isCtaId(id)) track("ai_data_cta_click", { ctaId: id, route: currentRoute() });
      }}
    >
      {children}
    </div>
  );
}
