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
  /**
   * `confirmation: needed` marks an entry drafted for owner confirmation (ADR-048). It must stay
   * `status: draft`, so it is ingested but never retrieved until the owner approves it by changing
   * the status to `published` and removing the flag (docs/relay/README.md, "Entries awaiting
   * confirmation").
   */
  confirmation: "needed" | null;
}

/** Minimal frontmatter parser for `key: value` lines between `---` fences. */
/** Strips one pair of surrounding quotes. */
const unquote = (v: string) =>
  v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0] ? v.slice(1, -1) : v;

export function parseFrontmatter(text: string, file: string): { data: Frontmatter; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const fields: Record<string, string> = {};
  for (const line of (m[1] as string).split("\n")) {
    // indexOf rather than a key/value regex: no backtracking on long or odd lines (CodeQL ReDoS).
    const trimmed = line.trim();
    const colon = trimmed.indexOf(":");
    const key = colon > 0 ? trimmed.slice(0, colon) : "";
    if (/^[a-z_]+$/.test(key)) fields[key] = unquote(trimmed.slice(colon + 1).trim());
  }
  const type = fields.type as EntryType;
  if (!fields.id || !/^[a-z0-9-]+$/.test(fields.id)) throw new Error(`${file}: invalid id`);
  if (!fields.title) throw new Error(`${file}: missing title`);
  if (!TYPES.includes(type)) throw new Error(`${file}: invalid type`);
  if (fields.status !== "draft" && fields.status !== "published")
    throw new Error(`${file}: status must be draft or published`);
  if (fields.confirmation && fields.confirmation !== "needed")
    throw new Error(`${file}: confirmation must be "needed" or absent`);
  if (fields.confirmation === "needed" && fields.status !== "draft")
    throw new Error(`${file}: an entry awaiting confirmation must be a draft`);
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
      confirmation: fields.confirmation === "needed" ? "needed" : null,
    },
    body,
  };
}

export interface RepoEntriesOptions {
  /**
   * Evals only: treat entries awaiting confirmation as published, to measure how they would
   * answer once approved. Never used by ingest.
   */
  approvePending?: boolean;
}

/** Seed knowledge from content/*.md (source `repo`). */
export function repoEntries(
  routeExists: (path: string) => boolean,
  options: RepoEntriesOptions = {},
): KnowledgeEntry[] {
  return repoContentFiles.map(({ file, text }) => {
    const parsed = parseFrontmatter(text, file);
    const { body } = parsed;
    const pending = parsed.data.confirmation === "needed";
    const data =
      pending && options.approvePending
        ? { ...parsed.data, status: "published" as const }
        : parsed.data;
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
      adminMeta: pending ? { needs_confirmation: true } : {},
      checksum: checksumOf({
        title: data.title,
        url,
        type: data.type,
        body,
        status: data.status,
        ...(pending ? { confirmation: "needed" } : {}),
      }),
    };
  });
}
