import { describe, expect, it } from "vitest";
import type { InsightView, PersonSummary } from "@vitalos/cms";
import { fullFixtureSet } from "@vitalos/cms/fixtures";
import { formatLabel, topicLabel } from "./labels";
import {
  authorCardProps,
  authorLinks,
  hasNamedAuthor,
  insightCardProps,
  insightFilterGroups,
  sortByPublishedDesc,
} from "./map";

const insights = fullFixtureSet.documents.insight as InsightView[];
const author: PersonSummary = { id: "p", slug: "example-person", title: "Example Person" };

describe("insight mapping", () => {
  it("sorts newest first and keeps undated pieces last", () => {
    const sorted = sortByPublishedDesc([
      { publishedAt: "2026-01-01" },
      { publishedAt: "not a date" },
      { publishedAt: "2026-03-01" },
    ]);
    expect(sorted.map((item) => item.publishedAt)).toEqual([
      "2026-03-01",
      "2026-01-01",
      "not a date",
    ]);
  });

  it("requires a named author", () => {
    expect(hasNamedAuthor({ authors: [author] })).toBe(true);
    expect(hasNamedAuthor({ authors: [] })).toBe(false);
    expect(hasNamedAuthor({ authors: [{ ...author, title: " " }] })).toBe(false);
  });

  it("links authors to their profiles on the article page", () => {
    expect(authorLinks([author])).toEqual([
      { name: "Example Person", href: "/people/example-person" },
    ]);
  });

  it("keeps author names plain inside a linked card (no nested links)", () => {
    const props = insightCardProps(insights[0]!);
    expect(props.href).toBe(`/insights/${insights[0]!.slug}`);
    expect(props.authors?.every((a) => a.href === undefined)).toBe(true);
    expect(props.eyebrow).toBe("Insight article");
  });

  it("builds an author card without a portrait", () => {
    expect(authorCardProps(author)).toEqual({
      name: "Example Person",
      href: "/people/example-person",
    });
  });

  it("labels formats and topics from the spec names, with a readable fallback", () => {
    expect(formatLabel("executive-briefing")).toBe("Executive briefing");
    expect(formatLabel("some-new-format")).toBe("Some new format");
    expect(topicLabel("ai-agents")).toBe("AI & Agents");
  });

  it("offers a topic filter only when topics differ", () => {
    expect(insightFilterGroups(insights)).toEqual([]);
    const mixed = [insights[0]!, { ...insights[1]!, topics: ["data-analytics"] }];
    const groups = insightFilterGroups(mixed);
    expect(groups[0]?.options.map((o) => o.label)).toEqual(["AI & Agents", "Data & Analytics"]);
  });
});
