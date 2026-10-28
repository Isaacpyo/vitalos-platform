import { describe, expect, it, vi } from "vitest";
import { createValidatingSink } from "./sink";

describe("guided brief analytics (W6)", () => {
  const setup = () => {
    const track = vi.fn();
    const onInvalid = vi.fn();
    return { track, onInvalid, sink: createValidatingSink({ track }, onInvalid) };
  };

  it("accepts the funnel events with counts, enums and booleans", () => {
    const { sink, track, onInvalid } = setup();
    sink.track("brief_started", { topic: "document-intake" });
    sink.track("brief_ai_opt_in", { enabled: false });
    sink.track("brief_questions_answered", { count: 3, source: "checklist" });
    sink.track("brief_completed", { source: "ai", cardsKept: 4, cardsEdited: 1 });
    sink.track("brief_shared", { source: "checklist" });
    sink.track("simple_form_submitted", { route: "/ai-data/contact" });
    expect(track).toHaveBeenCalledTimes(6);
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it("drops free text and unknown properties", () => {
    const { sink, track, onInvalid } = setup();
    // @ts-expect-error free text is not part of the contract
    sink.track("brief_started", { topic: "none", description: "we reconcile statements" });
    // @ts-expect-error not a declared topic
    sink.track("brief_started", { topic: "my own words" });
    // @ts-expect-error the count is a number, not text
    sink.track("brief_questions_answered", { count: "three", source: "ai" });
    expect(track).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(3);
  });
});
