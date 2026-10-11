import { describe, expect, it, vi } from "vitest";
import type { RichText } from "@vitalos/cms";
import { isSafeLink, normaliseRichText, richTextToPlainText } from "./rich-text";

const block = (
  text: string,
  extra: Record<string, unknown> = {},
  marks: string[] = [],
): RichText[number] => ({
  _type: "block",
  _key: `k-${text}`,
  children: [{ _type: "span", text, marks }],
  markDefs: [],
  ...extra,
});

describe("normaliseRichText", () => {
  it("maps styles to paragraph, headings and blockquote, and never emits an h1", () => {
    const nodes = normaliseRichText([
      block("a"),
      block("b", { style: "h1" }),
      block("c", { style: "h2" }),
      block("d", { style: "h3" }),
      block("e", { style: "h4" }),
      block("f", { style: "blockquote" }),
    ]);
    expect(nodes.map((n) => (n.type === "heading" ? `h${n.level}` : n.type))).toEqual([
      "paragraph",
      "h2",
      "h2",
      "h3",
      "h4",
      "blockquote",
    ]);
  });

  it("keeps only vetted links and known marks", () => {
    const [node] = normaliseRichText([
      {
        _type: "block",
        children: [
          { _type: "span", text: "safe", marks: ["strong", "l1"] },
          { _type: "span", text: "unsafe", marks: ["l2"] },
          { _type: "span", text: "internal", marks: ["l3", "em", "code", "unknown"] },
        ],
        markDefs: [
          { _key: "l1", _type: "link", href: "https://example.invalid/page" },
          { _key: "l2", _type: "link", href: "javascript:alert(1)" },
          { _key: "l3", _type: "link", href: "/what-we-do" },
        ],
      },
    ]);
    expect(node).toMatchObject({ type: "paragraph" });
    if (node?.type !== "paragraph") throw new Error("expected paragraph");
    expect(node.children[0]).toEqual({
      text: "safe",
      strong: true,
      href: "https://example.invalid/page",
    });
    expect(node.children[1]).toEqual({ text: "unsafe" });
    expect(node.children[2]).toEqual({
      text: "internal",
      em: true,
      code: true,
      href: "/what-we-do",
    });
  });

  it("rejects dangerous link targets", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,x",
      "http://example.invalid",
      "//evil.invalid",
      "/\\evil",
      "mailto:a@b.invalid",
      "not a url",
    ]) {
      expect(isSafeLink(href)).toBe(false);
    }
    expect(isSafeLink("https://example.invalid")).toBe(true);
    expect(isSafeLink("/legal/privacy")).toBe(true);
  });

  it("groups consecutive list items and nests deeper levels", () => {
    const nodes = normaliseRichText([
      block("one", { listItem: "bullet", level: 1 }),
      block("one-a", { listItem: "bullet", level: 2 }),
      block("two", { listItem: "bullet", level: 1 }),
      block("para"),
      block("first", { listItem: "number", level: 1 }),
    ]);
    expect(nodes.map((n) => n.type)).toEqual(["list", "paragraph", "list"]);
    const list = nodes[0];
    if (list?.type !== "list") throw new Error("expected list");
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
    expect(list.items[0]?.lists[0]?.items[0]?.children[0]?.text).toBe("one-a");
    const ordered = nodes[2];
    expect(ordered?.type === "list" && ordered.ordered).toBe(true);
  });

  it("drops empty blocks and unknown block types", () => {
    expect(normaliseRichText([block(""), { _type: "somethingNew" }])).toEqual([]);
    expect(normaliseRichText(undefined)).toEqual([]);
    expect(normaliseRichText(null)).toEqual([]);
  });

  it("requires attribution for pull quotes (no anonymous quotes)", () => {
    expect(normaliseRichText([{ _type: "pullQuote", quote: "A quote" }])).toEqual([]);
    expect(
      normaliseRichText([{ _type: "pullQuote", quote: "A quote", attribution: "A. Person" }]),
    ).toHaveLength(1);
  });

  it("requires alt text and a renderable URL for figures", () => {
    const image = {
      url: "https://cdn.sanity.io/images/p/d/a.jpg",
      alt: "A diagram",
      width: 800,
      height: 600,
    };
    expect(normaliseRichText([{ _type: "figure", image }])).toHaveLength(1);
    expect(normaliseRichText([{ _type: "figure", image: { ...image, alt: " " } }])).toEqual([]);
    expect(
      normaliseRichText([
        { _type: "figure", image: { ...image, url: "https://evil.invalid/a.jpg" } },
      ]),
    ).toEqual([]);
    expect(normaliseRichText([{ _type: "figure", image: { ...image, width: 0 } }])).toEqual([]);
  });

  it("keeps callouts and code blocks with content only", () => {
    expect(normaliseRichText([{ _type: "callout", title: "Note" }])).toEqual([]);
    expect(normaliseRichText([{ _type: "callout", text: "Body", title: "Note" }])).toHaveLength(1);
    expect(normaliseRichText([{ _type: "codeBlock", language: "ts" }])).toEqual([]);
    expect(
      normaliseRichText([{ _type: "codeBlock", code: "const a = 1;", language: "ts" }]),
    ).toHaveLength(1);
  });
});

describe("richTextToPlainText", () => {
  it("joins block text with blank lines and ignores marks", () => {
    expect(
      richTextToPlainText([block("First", {}, ["strong"]), block("Second"), { _type: "figure" }]),
    ).toBe("First\n\nSecond");
  });

  describe("dataTable", () => {
    const table = (over: Record<string, unknown> = {}) => ({
      _type: "dataTable",
      _key: "t1",
      caption: "Example table (fixture)",
      columns: ["Dimension", "Target", "Method"],
      rows: [
        { cells: ["Quality", "00", "Example (fixture)"] },
        { cells: ["Latency", "00 ms", "Example (fixture)"] },
      ],
      ...over,
    });

    it("normalises a valid table", () => {
      const nodes = normaliseRichText([table()]);
      expect(nodes).toEqual([
        {
          type: "dataTable",
          key: "t1",
          caption: "Example table (fixture)",
          columns: ["Dimension", "Target", "Method"],
          rows: [
            ["Quality", "00", "Example (fixture)"],
            ["Latency", "00 ms", "Example (fixture)"],
          ],
        },
      ]);
    });

    it.each([
      ["missing caption", { caption: undefined }],
      ["blank caption", { caption: "  " }],
      ["one column", { columns: ["Only"], rows: [{ cells: ["a"] }] }],
      ["blank column heading", { columns: ["A", "", "C"] }],
      ["no rows", { rows: [] }],
      ["ragged row", { rows: [{ cells: ["a", "b"] }] }],
      ["blank row header", { rows: [{ cells: ["", "b", "c"] }] }],
      ["non-array rows", { rows: "nope" }],
    ])("drops a table with %s and warns outside production", (_name, over) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(normaliseRichText([table(over)])).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });
});
