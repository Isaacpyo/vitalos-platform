import type { z } from "zod";
import { ContentNotFoundError, previewTokenHeader } from "./client";
import type { ContentClient } from "./client";
import {
  AuthorOrRedirect,
  CareersPage,
  FeedResponse,
  Home,
  PostPage,
  PostResponse,
  Preview,
  RoleResponse,
  SiteState,
  Sitemap,
  TopicResponse,
  TopicsResponse,
} from "./schemas";
import type {
  AuthorOrRedirectData,
  CareersPageData,
  FeedResponseData,
  HomeData,
  PostPageData,
  PostResponseData,
  PreviewData,
  RoleResponseData,
  SiteStateData,
  SitemapData,
  TopicResponseData,
  TopicsResponseData,
} from "./schemas";
import { tagsForRead } from "./tags";
import type { ReadName } from "./tags";

/**
 * Cached readers, one per read endpoint in `tags.json` `reads` (ADR-040).
 *
 * - Each read is wrapped in `unstable_cache(fn, keyParts, { tags, revalidate })` with the exact
 *   tags from `tags.json` and `CONTENT_CACHE_TTL_SECONDS`. Cache Components stay off.
 * - A failed read (network, timeout, 5xx, invalid payload) throws, so `unstable_cache` stores
 *   nothing and the last good entry (or ISR page) keeps being served.
 * - A 404 from the admin is a cacheable `{ kind: "missing" }`, so "not found" shares the TTL and
 *   the tags and is cleared by the same revalidation as the content.
 * - Not configured (no `CONTENT_API_BASE_URL`): site state is closed and every other read is
 *   "missing", without any request.
 * - Draft Mode reads go through `readPreview`, never cached.
 *
 * Framework-free: the cache function is injected (`server.ts` passes `unstable_cache`).
 */

export type ReadResult<T> = { kind: "ok"; data: T } | { kind: "missing" };

export type CacheFunction = <R>(
  fn: () => Promise<R>,
  keyParts: string[],
  options: { tags: string[]; revalidate: number },
) => () => Promise<R>;

export interface ReadersDeps {
  /** Null when the content API is not configured. */
  client: ContentClient | null;
  cache: CacheFunction;
  ttlSeconds: number;
}

export interface PostListQuery {
  page?: number;
  format?: string;
  topic?: string;
  author?: string;
}

/** Site state served while the content API is not configured: both sections closed. */
export const CLOSED_SITE_STATE: SiteStateData = {
  insightsOpen: false,
  careersOpen: false,
  nextDueAt: null,
  insights: { heading: "", intro: "", editorialNote: "" },
};

const CACHE_PREFIX = ["vitalos-content", "v1"];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSlug = (value: string | undefined): value is string =>
  value !== undefined && value.length <= 80 && slugPattern.test(value);
export const isPage = (value: number | undefined): value is number =>
  value !== undefined && Number.isSafeInteger(value) && value >= 1 && value <= 9999;

export function createReaders(deps: ReadersDeps) {
  /**
   * One cached read. The admin's 404 becomes a cached "missing"; every other failure propagates
   * (and is therefore never cached).
   */
  function cachedRead<S extends z.ZodType>(
    read: ReadName,
    keyParts: string[],
    tagParams: { slug?: string },
    pathAndQuery: string,
    schema: S,
  ): Promise<ReadResult<z.output<S>>> {
    const client = deps.client;
    if (!client) return Promise.resolve({ kind: "missing" });
    const load = async (): Promise<ReadResult<z.output<S>>> => {
      try {
        return { kind: "ok", data: await client.get(pathAndQuery, schema) };
      } catch (error) {
        if (error instanceof ContentNotFoundError) return { kind: "missing" };
        throw error;
      }
    };
    return deps.cache(load, [...CACHE_PREFIX, read, ...keyParts], {
      tags: tagsForRead(read, tagParams),
      revalidate: deps.ttlSeconds,
    })();
  }

  const missing = <T>(): Promise<ReadResult<T>> => Promise.resolve({ kind: "missing" });

  return {
    configured: deps.client !== null,

    /** Whether Insights and Careers are open. Not configured, or unknown to the admin: closed. */
    async siteState(): Promise<SiteStateData> {
      const result = await cachedRead(
        "site-state",
        [],
        {},
        "/api/content/v1/site-state",
        SiteState,
      );
      return result.kind === "ok" ? result.data : CLOSED_SITE_STATE;
    },

    listPosts(query: PostListQuery = {}): Promise<ReadResult<PostPageData>> {
      const page = query.page ?? 1;
      if (!isPage(page)) return missing();
      for (const value of [query.format, query.topic, query.author]) {
        if (value !== undefined && !isSlug(value)) return missing();
      }
      const params = new URLSearchParams({ page: String(page) });
      if (query.format) params.set("format", query.format);
      if (query.topic) params.set("topic", query.topic);
      if (query.author) params.set("author", query.author);
      return cachedRead(
        "insights/posts",
        [
          `page=${page}`,
          `format=${query.format ?? ""}`,
          `topic=${query.topic ?? ""}`,
          `author=${query.author ?? ""}`,
        ],
        {},
        `/api/content/v1/insights/posts?${params.toString()}`,
        PostPage,
      );
    },

    post(slug: string): Promise<ReadResult<PostResponseData>> {
      if (!isSlug(slug)) return missing();
      return cachedRead(
        "insights/posts/{slug}",
        [slug],
        { slug },
        `/api/content/v1/insights/posts/${slug}`,
        PostResponse,
      );
    },

    author(slug: string): Promise<ReadResult<AuthorOrRedirectData>> {
      if (!isSlug(slug)) return missing();
      return cachedRead(
        "insights/authors/{slug}",
        [slug],
        { slug },
        `/api/content/v1/insights/authors/${slug}`,
        AuthorOrRedirect,
      );
    },

    topics(): Promise<ReadResult<TopicsResponseData>> {
      return cachedRead(
        "insights/topics",
        [],
        {},
        "/api/content/v1/insights/topics",
        TopicsResponse,
      );
    },

    topic(slug: string, page = 1): Promise<ReadResult<TopicResponseData>> {
      if (!isSlug(slug) || !isPage(page)) return missing();
      return cachedRead(
        "insights/topics/{slug}",
        [slug, `page=${page}`],
        { slug },
        `/api/content/v1/insights/topics/${slug}?page=${page}`,
        TopicResponse,
      );
    },

    feed(): Promise<ReadResult<FeedResponseData>> {
      return cachedRead("insights/feed", [], {}, "/api/content/v1/insights/feed", FeedResponse);
    },

    careersPage(): Promise<ReadResult<CareersPageData>> {
      return cachedRead("careers/page", [], {}, "/api/content/v1/careers/page", CareersPage);
    },

    role(slug: string): Promise<ReadResult<RoleResponseData>> {
      if (!isSlug(slug)) return missing();
      return cachedRead(
        "careers/roles/{slug}",
        [slug],
        { slug },
        `/api/content/v1/careers/roles/${slug}`,
        RoleResponse,
      );
    },

    home(): Promise<ReadResult<HomeData>> {
      return cachedRead("home", [], {}, "/api/content/v1/home", Home);
    },

    sitemap(): Promise<ReadResult<SitemapData>> {
      return cachedRead("sitemap", [], {}, "/api/content/v1/sitemap", Sitemap);
    },

    /**
     * Draft Mode only: the working copy for a verified preview token. Never cached. The request
     * is signed with the read key (scope `read`) and carries the token for the admin to verify.
     */
    async readPreview(
      entity: "post" | "role",
      id: string,
      token: string,
    ): Promise<ReadResult<PreviewData>> {
      const client = deps.client;
      if (!client || !uuidPattern.test(id)) return { kind: "missing" };
      try {
        const data = await client.get(
          `/api/content/v1/preview/${entity}/${id.toLowerCase()}`,
          Preview,
          {
            scope: "read",
            headers: previewTokenHeader(token),
          },
        );
        return { kind: "ok", data };
      } catch (error) {
        if (error instanceof ContentNotFoundError) return { kind: "missing" };
        throw error;
      }
    },
  };
}

export type ContentReaders = ReturnType<typeof createReaders>;
