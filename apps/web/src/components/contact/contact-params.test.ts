import { describe, expect, it } from "vitest";
import { parseContactSearchParams } from "./contact-params";

describe("parseContactSearchParams", () => {
  it("returns an empty prefill without parameters", () => {
    expect(parseContactSearchParams({})).toEqual({ utm: {} });
  });

  it("accepts a known intent and ignores an unknown one", () => {
    expect(parseContactSearchParams({ intent: "ai" }).intent).toBe("ai");
    expect(parseContactSearchParams({ intent: "sales" }).intent).toBeUndefined();
    expect(parseContactSearchParams({ intent: ["engineering", "ai"] }).intent).toBe("engineering");
  });

  it("keeps a valid offer slug and defaults the intent to offer", () => {
    expect(parseContactSearchParams({ offer: "example-offer" })).toEqual({
      intent: "offer",
      offerSlug: "example-offer",
      utm: {},
    });
    expect(parseContactSearchParams({ offer: "example-offer", intent: "ai" }).intent).toBe("ai");
  });

  it("drops an offer slug that is not a slug", () => {
    expect(parseContactSearchParams({ offer: "Not A Slug!" })).toEqual({ utm: {} });
    expect(parseContactSearchParams({ offer: "a".repeat(121) }).offerSlug).toBeUndefined();
  });

  it("keeps valid utm values and drops invalid ones individually", () => {
    const prefill = parseContactSearchParams({
      utm_source: "newsletter",
      utm_medium: "x".repeat(101),
      utm_campaign: "line\nbreak",
      utm_term: "   ",
      utm_content: ["first", "second"],
    });
    expect(prefill.utm).toEqual({ source: "newsletter", content: "first" });
  });

  it("drops all utm values when together they exceed the size bound", () => {
    const long = "€".repeat(100); // 300 bytes each in UTF-8, valid on its own
    const prefill = parseContactSearchParams({
      utm_source: long,
      utm_medium: long,
      utm_campaign: long,
      utm_term: long,
      utm_content: long,
    });
    expect(prefill.utm).toEqual({});
  });
});
