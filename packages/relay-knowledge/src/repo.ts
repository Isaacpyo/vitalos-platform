import { checksumOf } from "@vitalos/relay-core/knowledge";
import type { KnowledgeEntry } from "@vitalos/relay-core/knowledge";
import { repoContentFiles } from "./generated/repo-content";

const TYPES = [
  "offer",
  "solution",
  "practice",
  "industry",
  "page",
  "guide",
  "policy",
  "faq",
  "company",
] as const;
type EntryType = (typeof TYPES)[number];

export interface Frontmatter {
  id: string;
  title: string;
  type: EntryType;
  url: string | null;
  status: "draft" | "published";
  owner: string | null;
  review_date: string | null;
}

/** Minimal frontmatter parser for `key: value` lines between `---` fences. */
export function parseFrontmatter(text: string, file: string): { data: Frontmatter; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const fields: Record<string, string> = {};
  for (const line of (m[1] as string).split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (kv) fields[kv[1] as string] = (kv[2] as string).replace(/^["']|["']$/g, "");
  }
  const type = fields.type as EntryType;
  if (!fields.id || !/^[a-z0-9-]+$/.test(fields.id)) throw new Error(`${file}: invalid id`);
  if (!fields.title) throw new Error(`${file}: missing title`);
  if (!TYPES.includes(type)) throw new Error(`${file}: invalid type`);
  if (fields.status !== "draft" && fields.status !== "published")
    throw new Error(`${file}: status must be draft or published`);
  const body = (m[2] as string).trim();
  if (fields.status === "published" && /TODO\(/.test(body))
    throw new Error(`${file}: published entries cannot contain TODO`);
  return {
    data: {
      id: fields.id,
      title: fields.title,
      type,
      url: fields.url ? fields.url : null,
      status: fields.status,
      owner: fields.owner || null,
      review_date: fields.review_date || null,
    },
    body,
  };
}

/** Seed knowledge from content/*.md (source `repo`). */
export function repoEntries(routeExists: (path: string) => boolean): KnowledgeEntry[] {
  return repoContentFiles.map(({ file, text }) => {
    const { data, body } = parseFrontmatter(text, file);
    const url = data.url && routeExists(data.url) ? data.url : null;
    return {
      source: "repo",
      sourceRef: `repo:content/${file}`,
      externalId: data.id,
      title: data.title,
      url,
      type: data.type,
      bodyMd: body,
      status: data.status,
      owner: data.owner,
      reviewDate: data.review_date,
      meta: {
        origin_path: `packages/relay-knowledge/content/${file}`,
        page_placements: url ? [url] : [],
      },
      adminMeta: {},
      checksum: checksumOf({ title: data.title, url, type: data.type, body, status: data.status }),
    };
  });
}
