import { describe, expect, it } from "vitest";
import type { RichText } from "@vitalos/cms";
import { buildArticleBody, slugifyHeading, tocForDisplay } from "./body-model";

const block = (style: string, text: string, key: string) => ({
  _type: "block",
  _key: key,
  style,
  children: [{ _type: "span", _key: `${key}-s`, text, marks: [] }],
  markDefs: [],
});

describe("slugifyHeading", () => {
  it("makes url-safe ids", () => {
    expect(slugifyHeading("Why it matters & how")).toBe("why-it-matters-and-how");
    expect(slugifyHeading("Café  au lait!")).toBe("cafe-au-lait");
    expect(slugifyHeading("***")).toBe("");
  });
});

describe("buildArticleBody", () => {
  const body: RichText = [
    block("normal", "Intro", "a"),
    block("h2", "First point", "b"),
    block("normal", "Text", "c"),
    block("h3", "Detail", "d"),
    { _type: "codeBlock", _key: "e", code: "const x = 1;", language: "ts" },
    block("h2", "First point", "f"),
    block("h4", "Minor", "g"),
    block("h1", "Content h1 becomes h2", "h"),
  ];

  it("lifts headings and code out, keeping other blocks in order", () => {
    const { segments } = buildArticleBody(body);
    expect(segments.map((segment) => segment.type)).toEqual([
      "blocks",
      "heading",
      "blocks",
      "heading",
      "code",
      "heading",
      "heading",
      "heading",
    ]);
  });

  it("derives the contents from the h2/h3 headings with unique ids", () => {
    const { toc } = buildArticleBody(body);
    expect(toc).toEqual([
      { id: "first-point", label: "First point", level: 2 },
      { id: "detail", label: "Detail", level: 3 },
      { id: "first-point-2", label: "First point", level: 2 },
      { id: "content-h1-becomes-h2", label: "Content h1 becomes h2", level: 2 },
    ]);
  });

  it("downgrades a content h1 so the page keeps one h1", () => {
    const { segments } = buildArticleBody([block("h1", "Title", "x")]);
    expect(segments[0]).toMatchObject({ type: "heading", level: 2 });
  });

  it("never collides with ids the page uses", () => {
    const { toc } = buildArticleBody([block("h2", "Authors", "x"), block("h2", "Related", "y")]);
    expect(toc.map((entry) => entry.id)).toEqual(["authors-2", "related-2"]);
  });

  it("keeps consecutive list items together in one segment", () => {
    const item = (text: string, key: string) => ({
      ...block("normal", text, key),
      listItem: "bullet",
      level: 1,
    });
    const { segments } = buildArticleBody([item("one", "l1"), item("two", "l2")]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: "blocks" });
  });

  it("shows a contents list only for longer pieces", () => {
    const short = buildArticleBody([block("h2", "One", "a"), block("h2", "Two", "b")]);
    expect(tocForDisplay(short)).toEqual([]);
    const long = buildArticleBody([
      block("h2", "One", "a"),
      block("h2", "Two", "b"),
      block("h2", "Three", "c"),
    ]);
    expect(tocForDisplay(long)).toHaveLength(3);
  });

  it("drops empty headings and renders nothing for an empty body", () => {
    expect(buildArticleBody([block("h2", "  ", "x")]).segments).toEqual([]);
    expect(buildArticleBody([]).segments).toEqual([]);
  });
});
