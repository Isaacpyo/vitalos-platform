import { describe, expect, it, vi } from "vitest";
import { createLogger } from "@vitalos/observability";
import { analyticsEventNames, isAnalyticsEventName } from "./events";
import { createLoggerAnalyticsSink, createValidatingSink, noopAnalyticsSink } from "./sink";
import type { AnalyticsSink } from "./sink";

describe("analytics taxonomy", () => {
  it("is the review brief's event list (ADR-046) plus the Stage 10 §22 content events", () => {
    expect([...analyticsEventNames].sort()).toEqual(
      [
        // 17 Oct 2026 review brief, WS5 (ADR-046).
        "enquiry_started",
        "enquiry_sent",
        "application_started",
        "application_sent",
        "relay_opened",
        "relay_question",
        "relay_handoff",
        "cta_click",
        "outbound_click",
        // Stage 10 §22 and PR #46.
        "case_study_view",
        "insight_to_offer_click",
        "insight_read",
        "lab_resource_click",
      ].sort(),
    );
    expect(isAnalyticsEventName("page_view")).toBe(false);
    expect(isAnalyticsEventName("toString")).toBe(false);
    // Retired names (replaced by the brief's names) are no longer accepted.
    expect(isAnalyticsEventName("contact_submit")).toBe(false);
    expect(isAnalyticsEventName("primary_cta_click")).toBe(false);
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
    sink.track("cta_click", { label: "talk-to-vitalos", page: "/" });
    sink.track("outbound_click", { host: "www.linkedin.com", page: "/about" });
    expect(track).toHaveBeenCalledWith("cta_click", { label: "talk-to-vitalos", page: "/" });
    expect(track).toHaveBeenCalledWith("outbound_click", {
      host: "www.linkedin.com",
      page: "/about",
    });
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it("drops events with unknown or personal properties", () => {
    const { sink, track, onInvalid } = setup();
    sink.track("enquiry_sent", {
      page: "/contact",
      email: "jane@example.invalid",
    } as never);
    expect(track).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledWith("enquiry_sent", 1);
  });

  it("drops events with malformed values and unknown event names", () => {
    const { sink, track, onInvalid } = setup();
    sink.track("case_study_view", { caseStudySlug: "Not A Slug!" });
    sink.track("page_view" as never, {} as never);
    sink.track("toString" as never, {} as never);
    sink.track("enquiry_sent", { page: "/contact?email=a@b.co" });
    sink.track("outbound_click", { host: "https://example.com/path?q=1", page: "/" });
    sink.track("cta_click", { label: "Jane Doe <jane@example.invalid>", page: "/" });
    expect(track).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(6);
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

describe("track helper", () => {
  it("slugifies CTA labels and keeps nothing else", async () => {
    const { slugifyLabel } = await import("./track");
    expect(slugifyLabel("Talk to Vitalos")).toBe("talk-to-vitalos");
    expect(slugifyLabel("  AI & Data  ")).toBe("ai-and-data");
    expect(slugifyLabel("Explore what we do →")).toBe("explore-what-we-do");
    expect(slugifyLabel("…")).toBe("");
    expect(slugifyLabel("x".repeat(80))).toHaveLength(64);
  });

  it("announces every event on window and never throws", async () => {
    const { ANALYTICS_EVENT, track } = await import("./track");
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const seen: unknown[] = [];
    target.addEventListener(ANALYTICS_EVENT, (event) => seen.push((event as CustomEvent).detail));
    try {
      track("relay_opened", { page: "/" });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(seen).toEqual([{ name: "relay_opened", properties: { page: "/" } }]);
  });
});

describe("client analytics bundle", () => {
  it("imports the taxonomy as types only, so zod never reaches the browser", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["./vercel-sink.ts", "./track.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/^import (?!type )[^;]*from "(zod|\.\/events|\.\/sink)";/m);
    }
  });
});
