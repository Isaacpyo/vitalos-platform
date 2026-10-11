import { describe, expect, it } from "vitest";
import { buildFilterGroups, rowFilterAttributes, rowMatches } from "./list-filter-model";
import type { FilterDimension } from "./list-filter-model";

interface Item {
  tags: string[];
}

const dimension: FilterDimension<Item> = {
  key: "tag",
  label: "Tag",
  valuesOf: (item) => item.tags.map((t) => ({ value: t, label: t.toUpperCase() })),
};

describe("buildFilterGroups", () => {
  it("builds a sorted group when options differ", () => {
    const groups = buildFilterGroups([{ tags: ["b"] }, { tags: ["a", "b"] }], [dimension]);
    expect(groups).toEqual([
      {
        key: "tag",
        label: "Tag",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
    ]);
  });

  it("builds no group when every item has the same single option", () => {
    expect(buildFilterGroups([{ tags: ["a"] }, { tags: ["a"] }], [dimension])).toEqual([]);
  });

  it("builds a group for a single option that some items lack", () => {
    expect(buildFilterGroups([{ tags: ["a"] }, { tags: [] }], [dimension])).toHaveLength(1);
  });

  it("builds no group without options, and ignores tokens that contain whitespace", () => {
    expect(buildFilterGroups([{ tags: [] }], [dimension])).toEqual([]);
    const groups = buildFilterGroups([{ tags: ["a b"] }, { tags: ["c"] }], [dimension]);
    expect(groups[0]?.options).toEqual([{ value: "c", label: "C" }]);
  });
});

describe("row attributes and matching", () => {
  const items = [{ tags: ["a", "b"] }, { tags: ["b"] }];
  const groups = buildFilterGroups(items, [dimension]);

  it("serialises a row's tokens", () => {
    expect(rowFilterAttributes(items[0]!, [dimension], groups)).toEqual({
      "data-filter-tag": "a b",
    });
    expect(rowFilterAttributes({ tags: [] }, [dimension], groups)).toEqual({});
  });

  it("matches rows against a selection; an empty selection matches everything", () => {
    expect(rowMatches({ tag: ["a", "b"] }, { tag: "a" })).toBe(true);
    expect(rowMatches({ tag: ["b"] }, { tag: "a" })).toBe(false);
    expect(rowMatches({}, { tag: "a" })).toBe(false);
    expect(rowMatches({ tag: ["b"] }, { tag: "" })).toBe(true);
    expect(rowMatches({ tag: ["b"] }, {})).toBe(true);
  });
});
