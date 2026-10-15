import "server-only";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { renderMarkdown } from "../markdown/render";
import type { RenderResult } from "../markdown/render";
import { getPreviewData, isDraftModeRequest } from "../preview";
import type { ReadResult } from "../readers";
import type {
  AuthorResponseData,
  PostDetailData,
  PostPageData,
  SiteStateData,
  TopicResponseData,
} from "../schemas";
import { getContentReaders } from "../server";
import { isBuildPhase, requireInsightsOpen } from "../site-state";
import { mediaOrigin, siteHosts } from "../site-hosts";
import { authorHref, postHref } from "./model";

/**
 * Loaders for the Insights pages (ADR-036). Every read goes through the cached, tagged readers,
 * so a page's ISR entry carries the same tags and is refreshed by the same sync events. A closed
 * or unconfigured section is `notFound()`. A failed read throws at runtime (ISR keeps the last
 * good page; the proxy answers 503 when nothing is cached) and reads as "not found" during
 * `next build`, so an unreachable admin cannot fail a deploy. Draft Mode reads the working copy.
 */

async function read<T>(load: () => Promise<ReadResult<T>>): Promise<T> {
  let result: ReadResult<T>;
  try {
    result = await load();
  } catch (error) {
    if (isBuildPhase()) notFound();
    throw error;
  }
  if (result.kind === "missing") notFound();
  return result.data;
}

export interface IndexPageData {
  state: SiteStateData;
  posts: PostPageData;
}

/** One page of the (optionally format-filtered) list; out-of-range pages are 404. */
export const loadIndexPage = cache(
  async (page: number, format?: string): Promise<IndexPageData> => {
    const state = await requireInsightsOpen();
    const posts = await read(() =>
      getContentReaders().listPosts({ page, ...(format ? { format } : {}) }),
    );
    if (page > 1 && page > posts.totalPages) notFound();
    return { state, posts };
  },
);

export interface TopicPageData {
  state: SiteStateData;
  topic: TopicResponseData;
}

export const loadTopicPage = cache(async (slug: string): Promise<TopicPageData> => {
  const state = await requireInsightsOpen();
  return { state, topic: await read(() => getContentReaders().topic(slug, 1)) };
});

export interface AuthorPageData {
  state: SiteStateData;
  author: AuthorResponseData;
  bio: RenderResult;
}

export const loadAuthorPage = cache(async (slug: string): Promise<AuthorPageData> => {
  const state = await requireInsightsOpen();
  const data = await read(() => getContentReaders().author(slug));
  if ("redirect" in data) permanentRedirect(authorHref(data.redirect));
  const bio = await renderMarkdown(data.author.bioMarkdown, {
    context: "author",
    siteHosts: siteHosts(),
  });
  return { state, author: data, bio };
});

export interface AuthorBlock {
  slug: string;
  name: string;
  roleTitle: string;
  firstName: string;
  bioHtml: string;
}

export interface ArticlePageData {
  state: SiteStateData;
  post: PostDetailData;
  body: RenderResult;
  authors: AuthorBlock[];
  /** The working copy's status in Draft Mode, else null. */
  previewStatus: string | null;
}

/** The working copy for this slug when this is a preview of it, else null. */
async function previewPost(slug: string): Promise<{ post: PostDetailData; status: string } | null> {
  if (!(await isDraftModeRequest())) return null;
  const preview = await getPreviewData();
  return preview?.entity === "post" && preview.post && preview.post.slug === slug
    ? { post: preview.post, status: preview.status }
    : null;
}

/** Author blocks: the author page's detail when it can be read, else the byline's own fields. */
async function authorBlocks(post: PostDetailData): Promise<AuthorBlock[]> {
  return Promise.all(
    post.authors.map(async (author): Promise<AuthorBlock> => {
      const fallback = {
        slug: author.slug,
        name: author.name,
        roleTitle: author.roleTitle,
        firstName: author.name.trim().split(/\s+/)[0] ?? author.name,
        bioHtml: "",
      };
      try {
        const result = await getContentReaders().author(author.slug);
        if (result.kind !== "ok" || "redirect" in result.data) return fallback;
        const bio = await renderMarkdown(result.data.author.bioMarkdown, {
          context: "author",
          siteHosts: siteHosts(),
        });
        return {
          ...fallback,
          firstName: result.data.author.firstName || fallback.firstName,
          bioHtml: bio.html,
        };
      } catch {
        return fallback;
      }
    }),
  );
}

export const loadArticlePage = cache(async (slug: string): Promise<ArticlePageData> => {
  const state = await requireInsightsOpen();
  const preview = await previewPost(slug);
  let post: PostDetailData;
  if (preview) {
    post = preview.post;
  } else {
    const data = await read(() => getContentReaders().post(slug));
    if ("redirect" in data) permanentRedirect(postHref(data.redirect));
    post = data;
  }
  // Rendered while the page is generated, so ISR serves the HTML at no cost per request.
  const [body, authors] = await Promise.all([
    renderMarkdown(post.bodyMarkdown, {
      context: "post",
      mediaOrigin: mediaOrigin(),
      siteHosts: siteHosts(),
    }),
    authorBlocks(post),
  ]);
  return { state, post, body, authors, previewStatus: preview?.status ?? null };
});

/** The published post for metadata and the OG image (never the working copy). */
export const loadPublishedPost = cache(async (slug: string): Promise<PostDetailData> => {
  await requireInsightsOpen();
  const preview = await previewPost(slug);
  if (preview) return preview.post;
  const data = await read(() => getContentReaders().post(slug));
  if ("redirect" in data) permanentRedirect(postHref(data.redirect));
  return data;
});

/** One page of a topic's posts (page 1 is `/insights/topics/{slug}`); out-of-range pages are 404. */
export const loadTopicPageN = cache(async (slug: string, page: number): Promise<TopicPageData> => {
  const state = await requireInsightsOpen();
  const topic = await read(() => getContentReaders().topic(slug, page));
  if (page > 1 && page > topic.posts.totalPages) notFound();
  return { state, topic };
});
