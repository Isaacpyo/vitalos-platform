import type { FeedResponseData, PostDetailData, PostPageData, PostSummaryData } from "../schemas";
import { INSIGHTS_BASE, INSIGHTS_FEED_PATH } from "../routes";

/**
 * Pure view models for the Insights pages (brief 5.1 to 5.3). No framework imports: the pages and
 * the feed route map contract data through these, and the tests pin every rule.
 */

export type PostSummary = PostSummaryData;
export type PostDetail = PostDetailData;

export const insightsCopy = {
  eyebrow: "INSIGHTS",
  all: "All",
  allInsights: "All insights",
  topics: "Topics",
  sectors: "Sectors",
  empty: "No Insights are published yet.",
  previous: "Previous",
  next: "Next",
  onThisPage: "ON THIS PAGE",
  sources: "SOURCES",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  copyCode: "Copy",
  codeCopied: "Copied",
  shareMenu: "Share this article",
  related: "Related insights",
  moreFrom: (firstName: string) => `More from ${firstName}`,
  titleSuffix: "Vitalos Insights",
  feedTitle: "Vitalos Insights",
  talkToVitalos: "Talk to Vitalos",
} as const;

export const postHref = (slug: string): string => `${INSIGHTS_BASE}/${slug}`;
export const authorHref = (slug: string): string => `${INSIGHTS_BASE}/authors/${slug}`;
export const topicHref = (slug: string): string => `${INSIGHTS_BASE}/topics/${slug}`;
export const FEED_PATH = INSIGHTS_FEED_PATH;
export const topicPageHref = (slug: string, page: number): string =>
  page > 1 ? `${topicHref(slug)}/page/${page}` : topicHref(slug);

/** The page title as the brief writes it: "{SEO title} | Vitalos Insights". */
export const insightsTitle = (title: string): string =>
  title.trim() ? `${title.trim()} | ${insightsCopy.titleSuffix}` : insightsCopy.titleSuffix;

const upper = (value: string) => value.toUpperCase();

/** Mono meta for cards: "AUTHOR NAME · 12 OCT 2026 · 6 MIN READ". */
export function metaLine(post: PostSummary): string {
  const authors = post.authors.map((author) => author.name).join(", ");
  return [authors, post.publishedAt.short, `${post.readingMinutes} min read`]
    .filter((part) => part.trim() !== "")
    .map(upper)
    .join(" · ");
}

/** Article byline: "PUBLISHED 12 OCT 2026 · UPDATED 14 OCT 2026 · 6 MIN READ" (UPDATED only when set). */
export function articleDatesLine(post: PostSummary): string {
  return [
    `Published ${post.publishedAt.short}`,
    ...(post.updatedAt ? [`Updated ${post.updatedAt.short}`] : []),
    `${post.readingMinutes} min read`,
  ]
    .map(upper)
    .join(" · ");
}

/** Covers show on grid items only when every item on the page has one (keeps the grid even). */
export const gridHasCovers = (items: readonly PostSummary[]): boolean =>
  items.length > 0 && items.every((item) => item.cover !== null);

/** Index URL for a page and optional format filter. Page 1 lives at `/insights`. */
export function indexHref(page: number, format?: string): string {
  if (format) {
    const query = new URLSearchParams({ format });
    if (page > 1) query.set("page", String(page));
    return `${INSIGHTS_BASE}?${query.toString()}`;
  }
  return page > 1 ? `${INSIGHTS_BASE}/page/${page}` : INSIGHTS_BASE;
}

export interface Pagination {
  page: number;
  totalPages: number;
  previous: string | null;
  next: string | null;
}

/** Previous and next links (`rel="prev"`/`"next"`); null when everything fits on one page. */
export function pagination(
  page: number,
  totalPages: number,
  hrefFor: (page: number) => string,
): Pagination | null {
  if (totalPages <= 1) return null;
  return {
    page,
    totalPages,
    previous: page > 1 ? hrefFor(page - 1) : null,
    next: page < totalPages ? hrefFor(page + 1) : null,
  };
}

export interface FormatTab {
  label: string;
  href: string;
  current: boolean;
}

/** "All" plus each format that has a published post, as plain links. */
export function formatTabs(formats: PostPageData["formats"], active?: string): FormatTab[] {
  return [
    { label: insightsCopy.all, href: INSIGHTS_BASE, current: !active },
    ...formats.map((format) => ({
      label: format.plural,
      href: indexHref(1, format.slug),
      current: format.slug === active,
    })),
  ];
}

export interface TopicLink {
  label: string;
  href: string;
  kind: "topic" | "sector";
}

export const topicLinks = (topics: PostPageData["topics"]): TopicLink[] =>
  topics.map((topic) => ({ label: topic.name, href: topicHref(topic.slug), kind: topic.kind }));

export interface IndexView {
  featured: PostSummary | null;
  items: PostSummary[];
  covers: boolean;
  pagination: Pagination | null;
  tabs: FormatTab[];
  topics: TopicLink[];
  empty: boolean;
}

/**
 * The index: the featured post only on page 1 of the unfiltered list (the admin's choice, else the
 * newest post), never repeated in the grid; the grid's covers follow the even-covers rule.
 */
export function buildIndexView(
  data: PostPageData,
  options: { format?: string | undefined; hrefFor?: (page: number) => string } = {},
): IndexView {
  const firstUnfiltered = data.page === 1 && !options.format;
  const featured = firstUnfiltered ? (data.featured ?? data.items[0] ?? null) : null;
  const items = featured ? data.items.filter((item) => item.id !== featured.id) : [...data.items];
  return {
    featured,
    items,
    covers: gridHasCovers(items),
    pagination: pagination(
      data.page,
      data.totalPages,
      options.hrefFor ?? ((page) => indexHref(page, options.format)),
    ),
    tabs: formatTabs(data.formats, options.format),
    topics: topicLinks(data.topics),
    empty: data.total === 0 && featured === null && items.length === 0,
  };
}

/** First name for "More from {first name}" when the author detail is not available. */
export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** True for an organisation author (the Vitalos team); an author without a kind is a person. */
export const isOrganisationAuthor = (author: { kind?: "person" | "organisation" | undefined }) =>
  author.kind === "organisation";

/**
 * The note at the end of an article: the organisation note when every author is an organisation
 * and that note is set, otherwise the approved note for posts by people.
 */
export function editorialNoteFor(
  post: Pick<PostDetail, "authors">,
  copy: { editorialNote: string; organisationEditorialNote?: string | undefined },
): string {
  const organisationOnly = post.authors.length > 0 && post.authors.every(isOrganisationAuthor);
  const organisationNote = copy.organisationEditorialNote?.trim();
  return organisationOnly && organisationNote ? organisationNote : copy.editorialNote;
}

/** A table of contents is shown only for three or more h2s (brief 5.2). */
export const showsToc = (toc: readonly { depth: number }[]): boolean =>
  toc.filter((entry) => entry.depth === 2).length >= 3;

const SITE_HOSTS = new Set(["vitalos.co.uk", "www.vitalos.co.uk"]);

/**
 * A post CTA link must be internal or on vitalos.co.uk (brief section 9); anything else is
 * replaced by the default "Talk to Vitalos" action.
 */
export function safeCtaHref(href: string): string | undefined {
  const value = href.trim();
  if (/^\/(?![/\\])[^\s\\]*$/.test(value)) return value;
  if (!URL.canParse(value)) return undefined;
  const url = new URL(value);
  return url.protocol === "https:" && SITE_HOSTS.has(url.hostname) && !url.username
    ? value
    : undefined;
}

const absolute = (siteUrl: string, path: string) => new URL(path, siteUrl).toString();

const isHttpsUrl = (value: string) => URL.canParse(value) && new URL(value).protocol === "https:";

/**
 * `Article` structured data. Nothing is fabricated: without a named author and a published date
 * it is null; an organisation author is an `Organization`, a person a `Person`; the image is the cover only when it is an https URL; the description is the SEO
 * description or the excerpt; the publisher is a reference to the site's Organization
 * (`/#organization`, described in full on the homepage, docs/seo/DECISIONS.md 22). It joins the
 * page's one JSON-LD graph with its WebPage and BreadcrumbList.
 */
export function articleJsonLd(
  post: PostDetail,
  ctx: { siteUrl: string },
  publisher: Record<string, unknown>,
): Record<string, unknown> | null {
  // An organisation author (the Vitalos team) is the Organization itself, at the site's root.
  const authors = post.authors
    .filter((author) => author.name.trim() !== "")
    .map((author) =>
      isOrganisationAuthor(author)
        ? { "@type": "Organization", name: author.name, url: absolute(ctx.siteUrl, "/") }
        : {
            "@type": "Person",
            name: author.name,
            url: absolute(ctx.siteUrl, authorHref(author.slug)),
          },
    );
  if (authors.length === 0 || Number.isNaN(Date.parse(post.publishedAt.iso))) return null;
  const url = absolute(ctx.siteUrl, postHref(post.slug));
  const description = (post.seo.description || post.excerpt).trim();
  const modified = post.updatedAt?.iso ?? post.lastModified;
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: post.title,
    url,
    // The page's WebPage node in the same graph (features/seo/graph.ts).
    mainEntityOfPage: { "@id": `${url}#webpage` },
    datePublished: post.publishedAt.iso,
    ...(modified && !Number.isNaN(Date.parse(modified)) ? { dateModified: modified } : {}),
    ...(description ? { description } : {}),
    author: authors,
    publisher,
    ...(post.cover && isHttpsUrl(post.cover.url)
      ? {
          image: {
            "@type": "ImageObject",
            url: post.cover.url,
            width: post.cover.width,
            height: post.cover.height,
          },
        }
      : {}),
    inLanguage: "en-GB",
  };
  return node;
}

// ---------------------------------------------------------------------------------------------
// RSS 2.0
// ---------------------------------------------------------------------------------------------

/** XML text: escapes markup characters and drops characters XML 1.0 cannot carry. */
export function xmlEscape(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const rfc822 = (iso: string): string => new Date(iso).toUTCString();

/** The feed: newest 20, title, link, guid = post id, pubDate, excerpt, author names. */
export function buildRss(
  feed: FeedResponseData,
  ctx: { siteUrl: string; description: string },
): string {
  const link = absolute(ctx.siteUrl, INSIGHTS_BASE);
  const self = absolute(ctx.siteUrl, FEED_PATH);
  const items = feed.items.slice(0, 20);
  const newest = items[0]?.publishedAt.iso;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "<channel>",
    `<title>${xmlEscape(insightsCopy.feedTitle)}</title>`,
    `<link>${xmlEscape(link)}</link>`,
    `<description>${xmlEscape(ctx.description || insightsCopy.feedTitle)}</description>`,
    "<language>en-gb</language>",
    `<atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml"/>`,
    ...(newest ? [`<lastBuildDate>${rfc822(newest)}</lastBuildDate>`] : []),
    ...items.map((post) =>
      [
        "<item>",
        `<title>${xmlEscape(post.title)}</title>`,
        `<link>${xmlEscape(absolute(ctx.siteUrl, postHref(post.slug)))}</link>`,
        `<guid isPermaLink="false">${xmlEscape(post.id)}</guid>`,
        `<pubDate>${rfc822(post.publishedAt.iso)}</pubDate>`,
        `<description>${xmlEscape(post.excerpt)}</description>`,
        ...post.authors.map((author) => `<dc:creator>${xmlEscape(author.name)}</dc:creator>`),
        "</item>",
      ].join(""),
    ),
    "</channel>",
    "</rss>",
  ];
  return `${lines.join("\n")}\n`;
}
