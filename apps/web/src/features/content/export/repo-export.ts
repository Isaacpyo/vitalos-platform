import type { ContentSource, InsightView, JobView, RichText } from "@vitalos/cms";
import { normaliseRichText } from "../../../lib/cms/rich-text";
import type { InlineNode, ListNode, RichTextNode } from "../../../lib/cms/rich-text";

/**
 * Exports the Insights and roles the `repo` content source serves (ADR-028) for
 * `manage.py import_repo_content` (ADR-039 5, brief A7): `{ posts: [...], roles: [...] }`, matched
 * by `sourcePath` so a second import changes nothing. Placeholders are never exported. Rich text
 * becomes Markdown the site's renderer reads. Pure apart from the source it is given.
 */

export interface ExportedPost {
  sourcePath: string;
  slug: string;
  title: string;
  excerpt: string;
  format: string;
  bodyMarkdown: string;
  authors: string[];
  topics: string[];
}

export interface ExportedRole {
  sourcePath: string;
  slug: string;
  title: string;
  summary: string;
  location: string;
  employmentType: string;
  about: string;
}

export interface RepoExport {
  posts: ExportedPost[];
  roles: ExportedRole[];
}

const inline = (nodes: readonly InlineNode[]): string =>
  nodes
    .map((node) => {
      let text = node.code ? `\`${node.text.replace(/`/g, "")}\`` : escapeMarkdown(node.text);
      if (node.em) text = `*${text}*`;
      if (node.strong) text = `**${text}**`;
      return node.href ? `[${text}](${node.href})` : text;
    })
    .join("");

/** Escapes characters that would otherwise start Markdown or HTML constructs. */
function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>#|])/g, "\\$1");
}

function list(node: ListNode, depth = 0): string {
  const indent = "  ".repeat(depth);
  return node.items
    .map((item, index) => {
      const marker = node.ordered ? `${index + 1}.` : "-";
      const nested = item.lists.map((child) => `\n${list(child, depth + 1)}`).join("");
      return `${indent}${marker} ${inline(item.children)}${nested}`;
    })
    .join("\n");
}

function block(node: RichTextNode): string | null {
  switch (node.type) {
    case "paragraph":
      return inline(node.children);
    case "heading":
      return `${"#".repeat(node.level)} ${inline(node.children)}`;
    case "blockquote":
      return `> ${inline(node.children)}`;
    case "list":
      return list(node);
    case "callout":
      return `> [!NOTE]\n> ${node.title ? `**${escapeMarkdown(node.title)}** ` : ""}${escapeMarkdown(node.text)}`;
    case "pullQuote":
      return `> ${escapeMarkdown(node.quote)}\n>\n> ${escapeMarkdown(node.attribution)}`;
    case "codeBlock":
      return `\`\`\`${node.language ?? ""}\n${node.code.replace(/```/g, "'''")}\n\`\`\``;
    case "dataTable": {
      const row = (cells: readonly string[]) => `| ${cells.map(escapeMarkdown).join(" | ")} |`;
      return [row(node.columns), row(node.columns.map(() => "---")), ...node.rows.map(row)].join(
        "\n",
      );
    }
    case "figure":
      // Images are re-uploaded through the admin's media library; the export keeps a note.
      return node.caption ? `*${escapeMarkdown(node.caption)}*` : null;
  }
}

/** Portable-text-like rich text as Markdown for the admin's editor. */
export function richTextToMarkdown(value: RichText | undefined): string {
  return normaliseRichText(value)
    .map(block)
    .filter((text): text is string => Boolean(text && text.trim()))
    .join("\n\n");
}

function post(view: InsightView): ExportedPost {
  return {
    sourcePath: `repo:insight/${view.slug}`,
    slug: view.slug,
    title: view.title,
    excerpt: view.summary ?? "",
    format: view.format,
    bodyMarkdown: richTextToMarkdown(view.body),
    authors: view.authors.map((author) => author.title).filter((name) => name.trim() !== ""),
    topics: [...view.topics],
  };
}

function role(view: JobView): ExportedRole {
  return {
    sourcePath: `repo:job/${view.slug}`,
    slug: view.slug,
    title: view.title,
    summary: view.summary ?? "",
    location: view.location ?? "",
    employmentType: view.employmentType ?? "",
    about: richTextToMarkdown(view.description),
  };
}

export async function exportRepoContent(source: ContentSource): Promise<RepoExport> {
  const [insightSummaries, jobSummaries] = await Promise.all([
    source.listSummaries("insight"),
    source.listSummaries("job"),
  ]);
  const insights = await Promise.all(
    insightSummaries.map((summary) => source.getDocument("insight", summary.slug)),
  );
  const jobs = await Promise.all(
    jobSummaries.map((summary) => source.getDocument("job", summary.slug)),
  );
  return {
    posts: insights
      .filter((view): view is InsightView => view !== null && view.placeholder !== true)
      .map(post),
    roles: jobs
      .filter((view): view is JobView => view !== null && view.placeholder !== true)
      .map(role),
  };
}
