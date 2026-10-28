import { describe, expect, it, vi } from "vitest";
import { createLogger } from "@vitalos/observability";
import { analyticsEventNames, isAnalyticsEventName } from "./events";
import { createLoggerAnalyticsSink, createValidatingSink, noopAnalyticsSink } from "./sink";
import type { AnalyticsSink } from "./sink";

describe("analytics taxonomy", () => {
  it("is exactly the Stage 10 §22 event list plus the SEO brief's conversions", () => {
    expect([...analyticsEventNames].sort()).toEqual(
      [
        // docs/seo/DECISIONS.md 23: application submits and Insight reads (PR #46).
        "application_submit",
        "insight_read",
        "case_study_view",
        "contact_submit",
        "insight_to_offer_click",
        "lab_resource_click",
        "offer_enquiry_submit",
        // Links to a Vitalos product's own site (Products, 17 Oct 2026).
        "outbound_click",
        "primary_cta_click",
        "trust_enquiry_submit",
        // Vitalos AI & Data marketing experience (W5, ADR-054).
        "workflow_started",
        "explorer_topic_selected",
        "demo_sample_chosen",
        "demo_stage_viewed",
        "demo_evidence_expanded",
        "ai_data_cta_click",
      ].sort(),
    );
    expect(isAnalyticsEventName("page_view")).toBe(false);
    expect(isAnalyticsEventName("toString")).toBe(false);
  });
});

describe("AI & Data events", () => {
  const track = vi.fn();
  const onInvalid = vi.fn();
  const sink = createValidatingSink({ track }, onInvalid);

  it("accepts slugs and enums and rejects free text", () => {
    sink.track("workflow_started", { source: "hero", topic: "document-intake" });
    sink.track("demo_stage_viewed", { surface: "hero", sampleId: "statement", stage: "check" });
    expect(track).toHaveBeenCalledTimes(2);
    sink.track("workflow_started", {
      source: "hero",
      topic: "my own words about payroll",
    } as never);
    sink.track("demo_evidence_expanded", {
      surface: "hero",
      sampleId: "statement",
      itemId: "Line 6 of the statement",
    } as never);
    expect(track).toHaveBeenCalledTimes(2);
    expect(onInvalid).toHaveBeenCalledTimes(2);
  });
});

describe("validating sink", () => {
  const setup = () => {
    const track = vi.fn();
    const onInvalid = vi.fn();
    const inner: AnalyticsSink = { track };
    return { track, onInvalid, sink: createValidatingSink(inner, onInvalid) };
  };

  it("forwards valid events", () => {
    const { sink, track, onInvalid } = setup();
    sink.track("primary_cta_click", { ctaId: "talk-to-vitalos", route: "/" });
    expect(track).toHaveBeenCalledWith("primary_cta_click", {
      ctaId: "talk-to-vitalos",
      route: "/",
    });
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it("drops events with unknown or personal properties", () => {
    const { sink, track, onInvalid } = setup();
    sink.track("contact_submit", {
      outcome: "success",
      route: "/contact",
      email: "jane@example.invalid",
    } as never);
    expect(track).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledWith("contact_submit", 1);
  });

  it("drops events with malformed values and unknown event names", () => {
    const { sink, track, onInvalid } = setup();
    sink.track("case_study_view", { caseStudySlug: "Not A Slug!" });
    sink.track("page_view" as never, {} as never);
    sink.track("toString" as never, {} as never);
    sink.track("contact_submit", { outcome: "success", route: "/contact?email=a@b.co" });
    expect(track).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(4);
  });
});

describe("sinks", () => {
  it("noop sink does nothing", () => {
    expect(() =>
      noopAnalyticsSink.track("case_study_view", { caseStudySlug: "example-case" }),
    ).not.toThrow();
  });

  it("logger sink writes an analytics.event record", () => {
    const lines: string[] = [];
    const logger = createLogger({ service: "web", env: "test", sink: (line) => lines.push(line) });
    createLoggerAnalyticsSink(logger).track("insight_to_offer_click", {
      insightSlug: "example-insight",
      offerSlug: "example-offer",
    });
    expect(JSON.parse(lines[0]!)).toMatchObject({
      event: "analytics.event",
      analyticsEvent: "insight_to_offer_click",
      insightSlug: "example-insight",
      offerSlug: "example-offer",
    });
  });
});

describe("client analytics bundle", () => {
  it("imports the taxonomy as types only, so zod never reaches the browser", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./vercel-sink.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^import (?!type )[^;]*from "(zod|\.\/events|\.\/sink)";/m);
  });
});
