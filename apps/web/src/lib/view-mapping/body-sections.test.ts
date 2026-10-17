import { describe, expect, it } from "vitest";
import type { RichTextBlock } from "@vitalos/cms";
import { isCardBody, isCardSection, splitBody } from "./body-sections";

let key = 0;
const block = (text: string, extra: Record<string, unknown> = {}): RichTextBlock => ({
  _type: "block",
  _key: `b${(key += 1)}`,
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", _key: `s${key}`, text, marks: [] }],
  ...extra,
});
const h2 = (text: string) => block(text, { style: "h2" });
const li = (text: string) => block(text, { listItem: "bullet", level: 1 });

describe("splitBody", () => {
  it("splits at h2s into paragraphs and list items, keeping the lead", () => {
    const { lead, sections } = splitBody([
      block("Lead (fixture)."),
      h2("One (fixture)"),
      block("Para one (fixture)."),
      h2("Two (fixture)"),
      li("Item a (fixture)"),
      li("Item b (fixture)"),
    ]);
    expect(lead.paragraphs).toEqual(["Lead (fixture)."]);
    expect(sections.map((section) => section.title)).toEqual(["One (fixture)", "Two (fixture)"]);
    expect(sections[0]?.paragraphs).toEqual(["Para one (fixture)."]);
    expect(sections[1]?.items).toEqual(["Item a (fixture)", "Item b (fixture)"]);
    expect(sections.some((section) => section.rich)).toBe(false);
  });

  it("marks a section with a link or another block type as rich", () => {
    const { sections } = splitBody([
      h2("Linked (fixture)"),
      block("See (fixture)", { markDefs: [{ _key: "l", _type: "link", href: "/x" }] }),
      h2("Figure (fixture)"),
      { _type: "figure", _key: "f" },
    ]);
    expect(sections.map((section) => section.rich)).toEqual([true, true]);
  });

  it("keeps a section of paragraphs with inline links a card, and nothing else", () => {
    const link = { markDefs: [{ _key: "l", _type: "link", href: "/products/fauward" }] };
    const { sections } = splitBody([
      h2("Linked (fixture)"),
      block("Plain (fixture)."),
      block("See (fixture)", link),
      h2("Linked then list (fixture)"),
      block("See (fixture)", link),
      li("Item (fixture)"),
      h2("Figure then link (fixture)"),
      { _type: "figure", _key: "f" },
      block("See (fixture)", link),
    ]);
    expect(sections.map((section) => section.inlineLinks)).toEqual([true, true, false]);
    expect(sections.map(isCardSection)).toEqual([true, false, false]);
    // The linked paragraph stays out of `paragraphs`: callers render its blocks.
    expect(sections[0]?.paragraphs).toEqual(["Plain (fixture)."]);
    expect(isCardBody(splitBody([h2("A"), block("a.", link), h2("B"), block("b.")]))).toBe(true);
  });

  it("reads headed paragraphs only as a card body", () => {
    expect(isCardBody(splitBody([h2("A"), block("a."), h2("B"), block("b.")]))).toBe(true);
    expect(isCardBody(splitBody([h2("A"), li("a"), h2("B"), block("b.")]))).toBe(false);
    expect(isCardBody(splitBody(undefined))).toBe(false);
  });
});
