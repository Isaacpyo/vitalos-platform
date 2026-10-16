import { describe, expect, it } from "vitest";
import { createRepoContentSource } from "@vitalos/cms/repo";
import { createFixtureContentSource } from "@vitalos/cms/fixtures";
import { createDraftContentSource } from "@vitalos/cms/draft";
import { exportRepoContent, richTextToMarkdown } from "./repo-export";

describe("exportRepoContent", () => {
  it("exports nothing from the repo source today (its placeholders are dropped)", async () => {
    expect(await exportRepoContent(createRepoContentSource())).toEqual({ posts: [], roles: [] });
  });

  it("never exports placeholder documents", async () => {
    const draft = await exportRepoContent(createDraftContentSource());
    expect(draft).toEqual({ posts: [], roles: [] });
  });

  it("exports Insights and roles in the shape import_repo_content reads", async () => {
    const data = await exportRepoContent(createFixtureContentSource("full"));
    expect(data.posts.length).toBeGreaterThan(0);
    expect(data.roles.length).toBeGreaterThan(0);
    const post = data.posts[0]!;
    expect(post.sourcePath).toBe(`repo:insight/${post.slug}`);
    expect(Object.keys(post).sort()).toEqual(
      [
        "authors",
        "bodyMarkdown",
        "excerpt",
        "format",
        "slug",
        "sourcePath",
        "title",
        "topics",
      ].sort(),
    );
    expect(post.authors.every((name) => name.trim() !== "")).toBe(true);
    const role = data.roles[0]!;
    expect(role.sourcePath).toBe(`repo:job/${role.slug}`);
    expect(Object.keys(role).sort()).toEqual(
      ["about", "employmentType", "location", "slug", "sourcePath", "summary", "title"].sort(),
    );
    // Stable: the same input gives the same file, so a re-import changes nothing.
    expect(await exportRepoContent(createFixtureContentSource("full"))).toEqual(data);
  });
});

describe("richTextToMarkdown", () => {
  it("writes headings, paragraphs, marks, links and lists as Markdown, escaping markup", () => {
    const markdown = richTextToMarkdown([
      { _type: "block", _key: "a", style: "h2", children: [{ _type: "span", text: "Heading" }] },
      {
        _type: "block",
        _key: "b",
        style: "normal",
        markDefs: [{ _key: "l", _type: "link", href: "https://example.test/" }],
        children: [
          { _type: "span", text: "Bold", marks: ["strong"] },
          { _type: "span", text: " and <script> " },
          { _type: "span", text: "link", marks: ["l"] },
        ],
      },
      {
        _type: "block",
        _key: "c",
        style: "normal",
        listItem: "bullet",
        level: 1,
        children: [{ _type: "span", text: "Item" }],
      },
    ] as never);
    expect(markdown).toBe(
      "## Heading\n\n**Bold** and \\<script\\> [link](https://example.test/)\n\n- Item",
    );
  });

  it("is empty for missing rich text", () => {
    expect(richTextToMarkdown(undefined)).toBe("");
  });
});
