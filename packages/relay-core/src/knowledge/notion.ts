import "server-only";
import { Client } from "@notionhq/client";
import type { FaqRow } from "./faq";
import { normaliseWhitespace, plainText } from "./faq";

/**
 * Master FAQ reader for the Notion API (data sources, API version 2025-09-03 or later).
 * Least privilege: the token belongs to an internal integration with Read content only, connected
 * to the Master FAQ page alone. Only that data source and hub page are ever read.
 */
export interface NotionFaqOptions {
  token: string;
  dataSourceId: string;
  hubPageId: string;
  notionVersion?: string;
  /** Minimum spacing between requests (Notion allows about 3 per second). */
  minIntervalMs?: number;
}

export const DEFAULT_NOTION_VERSION = "2025-09-03";

type Prop = {
  type?: string;
  title?: { plain_text?: string }[];
  rich_text?: { plain_text?: string }[];
  select?: { name?: string } | null;
  status?: { name?: string } | null;
  multi_select?: { name?: string }[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function text(p: Prop | undefined): string {
  if (!p) return "";
  if (p.title) return plainText(p.title);
  if (p.rich_text) return plainText(p.rich_text);
  return "";
}

const select = (p: Prop | undefined) => p?.select?.name ?? p?.status?.name ?? null;
const multi = (p: Prop | undefined) =>
  (p?.multi_select ?? []).map((o) => o.name ?? "").filter(Boolean);

/** Maps one Notion page of the Master FAQ data source to a plain-text row. */
export function rowFromPage(page: {
  id: string;
  url?: string;
  last_edited_time?: string;
  in_trash?: boolean;
  archived?: boolean;
  properties: Record<string, Prop>;
}): FaqRow | null {
  if (page.in_trash || page.archived) return null;
  const p = page.properties;
  const status = select(p.Status);
  const id = text(p.ID);
  if (!id || (status !== "Verified" && status !== "Needs confirmation")) return null;
  return {
    notionPageId: page.id,
    notionUrl: page.url ?? `https://app.notion.com/p/${page.id.replace(/-/g, "")}`,
    lastEditedAt: page.last_edited_time ?? null,
    id: normaliseWhitespace(id),
    question: text(p.Question),
    section: select(p.Section) ?? "",
    shortAnswer: text(p["Short answer"]),
    fullAnswer: text(p["Full answer"]),
    status: status,
    pagePlacement: multi(p["Page placement"]),
    linkedOfferCta: select(p["Linked offer / CTA"]),
    audienceTags: multi(p["Audience tags"]),
    source: text(p.Source) || null,
    confirmNote: text(p["Confirm note"]) || null,
  };
}

export class NotionFaqReader {
  private readonly client: Client;
  private last = 0;

  constructor(private readonly options: NotionFaqOptions) {
    this.client = new Client({
      auth: options.token,
      notionVersion: options.notionVersion ?? DEFAULT_NOTION_VERSION,
    });
  }

  /** Spaces requests and retries 429/5xx with exponential backoff (honouring Retry-After). */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.last + (this.options.minIntervalMs ?? 350) - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      try {
        return await fn();
      } catch (error) {
        const e = error as {
          status?: number;
          code?: string;
          headers?: { get?: (h: string) => string | null };
        };
        const retryable =
          e.status === 429 ||
          e.code === "rate_limited" ||
          (typeof e.status === "number" && e.status >= 500);
        if (!retryable || attempt >= 4) throw error;
        const retryAfter = Number(e.headers?.get?.("retry-after") ?? "");
        await sleep(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt,
        );
      }
    }
  }

  /** Hub page Status ("Draft", "Active", …); Active means founder sign-off. */
  async hubActive(): Promise<boolean> {
    const page = (await this.call(() =>
      this.client.pages.retrieve({ page_id: this.options.hubPageId }),
    )) as {
      properties?: Record<string, Prop>;
    };
    return select(page.properties?.Status) === "Active";
  }

  /** All rows, or rows edited on or after `sinceIso` (incremental). Paginates 100 at a time. */
  async rows(sinceIso?: string): Promise<{ rows: FaqRow[]; seenPageIds: string[] }> {
    const rows: FaqRow[] = [];
    const seenPageIds: string[] = [];
    let cursor: string | undefined;
    do {
      const res = (await this.call(() =>
        this.client.dataSources.query({
          data_source_id: this.options.dataSourceId,
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
          ...(sinceIso
            ? {
                filter: {
                  timestamp: "last_edited_time",
                  last_edited_time: { on_or_after: sinceIso },
                },
              }
            : {}),
        }),
      )) as { results: unknown[]; has_more: boolean; next_cursor: string | null };
      for (const page of res.results) {
        const p = page as Parameters<typeof rowFromPage>[0];
        seenPageIds.push(p.id);
        const row = rowFromPage(p);
        if (row) rows.push(row);
      }
      cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
    } while (cursor);
    return { rows, seenPageIds };
  }
}
