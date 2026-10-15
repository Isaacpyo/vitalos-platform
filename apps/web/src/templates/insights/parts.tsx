import Image from "next/image";
import type { ReactNode } from "react";
import { Icon } from "@vitalos/ui";
import { isAllowedImage } from "../../features/content/markdown/render";
import {
  insightsCopy,
  metaLine,
  postHref,
  safeCtaHref,
} from "../../features/content/insights/model";
import type {
  FormatTab,
  Pagination,
  PostSummary,
  TopicLink,
} from "../../features/content/insights/model";
import { mediaOrigin } from "../../features/content/site-hosts";
import { ClosingBand } from "../commercial/bands";
import { PageHeroBand } from "../institutional/layout";

/**
 * Building blocks of the Insights pages (brief 5.1 to 5.6) in the site's design (pages redesign,
 * 15 Oct 2026): the dark page hero, rounded cards with the round arrow, and the closing card.
 * Server components, design tokens only (no raw colours).
 */

export const monoLabel = "font-mono text-eyebrow tracking-widest uppercase";

/** A media-host image through next/image; nothing for any other host (never a broken image). */
export function ContentImage({
  image,
  sizes,
  priority = false,
  className,
}: Readonly<{
  image: { url: string; alt: string; width: number; height: number };
  sizes: string;
  priority?: boolean;
  className?: string;
}>) {
  if (!isAllowedImage(image.url, mediaOrigin())) return null;
  return (
    <Image
      src={image.url}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      priority={priority}
      className={className ?? "aspect-video h-auto w-full rounded-xl object-cover"}
    />
  );
}

/**
 * The page hero of the Insights and Careers pages: the site's dark hero (PageHeroBand) with the
 * eyebrow, the single H1 and the intro; `full` is the larger hero of an index page.
 */
export function InsightsHero({
  eyebrow = insightsCopy.eyebrow,
  title,
  intro,
  crumbs,
  actions,
  media,
  full = false,
  children,
}: Readonly<{
  eyebrow?: string;
  title: string;
  intro?: string | undefined;
  /** Invisible BreadcrumbList JSON-LD (Breadcrumbs); there is no visible trail. */
  crumbs?: ReactNode;
  actions?: ReactNode;
  media?: ReactNode;
  full?: boolean;
  children?: ReactNode;
}>) {
  return (
    <PageHeroBand
      crumbs={crumbs}
      eyebrow={eyebrow}
      title={title}
      lead={intro}
      actions={actions}
      media={media}
      full={full}
    >
      {children}
    </PageHeroBand>
  );
}

/** The round arrow of a linked card, drawn as FeatureGrid draws it. Decorative. */
export function CardArrow() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-10 shrink-0 items-center justify-center self-start rounded-full border border-tone-border text-tone-link transition-[translate,border-color,background-color,color] duration-(--duration-reveal) ease-(--ease-standard) group-hover:translate-x-1 group-hover:border-transparent group-hover:bg-tone-action group-hover:text-tone-action-text"
    >
      <Icon name="arrow-right" size={16} />
    </span>
  );
}

/** A linked card's frame: rounded with a hairline; lifts and turns blue on hover or focus. */
export const cardFrame =
  "group relative flex h-full min-w-0 flex-col gap-(--space-4) rounded-2xl border border-tone-border bg-tone-bg p-(--space-6) transition-[translate,border-color,box-shadow] duration-(--duration-reveal) ease-(--ease-standard) hover:-translate-y-1 hover:border-blue-600/60 hover:shadow-floating focus-within:border-blue-600/60";

/** The title link of a card, stretched over the whole card. */
export const cardLink =
  "after:absolute after:inset-0 after:rounded-2xl hover:text-tone-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus";

/** One grid item: a card with the cover, mono format tag, title, excerpt, mono meta and arrow. */
export function PostCard({
  post,
  headingLevel = 2,
  showCover,
}: Readonly<{ post: PostSummary; headingLevel?: 2 | 3; showCover: boolean }>) {
  const Title = `h${headingLevel}` as "h2";
  return (
    <article className={cardFrame}>
      {showCover && post.cover ? (
        <ContentImage
          image={post.cover}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
      ) : null}
      <p className={`${monoLabel} m-0 text-tone-eyebrow`}>{post.format.label}</p>
      <Title className="m-0 text-h3 text-tone-heading text-balance">
        <a href={postHref(post.slug)} className={cardLink}>
          {post.title}
        </a>
      </Title>
      <p className="m-0 line-clamp-3 text-body text-tone-text">{post.excerpt}</p>
      <div className="mt-auto flex items-end justify-between gap-(--space-4) pt-(--space-2)">
        <p className={`${monoLabel} m-0 text-tone-muted`}>{metaLine(post)}</p>
        <CardArrow />
      </div>
    </article>
  );
}

/** 3 columns at 1024px and up, 2 from 640px, 1 below. */
export function PostGrid({
  posts,
  covers,
  headingLevel = 2,
}: Readonly<{ posts: readonly PostSummary[]; covers: boolean; headingLevel?: 2 | 3 }>) {
  if (posts.length === 0) return null;
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <li key={post.id} className="min-w-0">
          <PostCard post={post} showCover={covers} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}

/** The featured post as a wide card: cover 7 of 12 columns (when it has one), text 5. */
export function FeaturedPost({ post }: Readonly<{ post: PostSummary }>) {
  return (
    <article
      className={`${cardFrame} lg:grid lg:grid-cols-12 lg:items-center lg:gap-(--space-7) lg:p-(--space-7)`}
    >
      {post.cover ? (
        <div className="lg:col-span-7">
          <ContentImage image={post.cover} priority sizes="(min-width: 1024px) 58vw, 100vw" />
        </div>
      ) : null}
      <div
        className={`flex min-w-0 flex-col gap-(--space-4) ${post.cover ? "lg:col-span-5" : "lg:col-span-8"}`}
      >
        <p className={`${monoLabel} m-0 text-tone-eyebrow`}>{post.format.label}</p>
        <h2 className="m-0 text-h2 text-tone-heading text-balance">
          <a href={postHref(post.slug)} className={cardLink}>
            {post.title}
          </a>
        </h2>
        <p className="m-0 text-body-l text-tone-text">{post.excerpt}</p>
        <div className="flex items-end justify-between gap-(--space-4)">
          <p className={`${monoLabel} m-0 text-tone-muted`}>{metaLine(post)}</p>
          <CardArrow />
        </div>
      </div>
    </article>
  );
}

/** Format filters as plain links (no client JavaScript). */
export function FormatTabs({ tabs }: Readonly<{ tabs: readonly FormatTab[] }>) {
  if (tabs.length <= 1) return null;
  return (
    <nav aria-label="Formats">
      <ul className="m-0 flex list-none flex-wrap gap-x-(--space-5) gap-y-(--space-3) p-0">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <a
              href={tab.href}
              {...(tab.current ? { "aria-current": "page" as const } : {})}
              className={`inline-block border-b-2 pb-(--space-1) text-body ${
                tab.current
                  ? "border-tone-action font-semibold text-tone-heading"
                  : "border-transparent text-tone-text hover:text-tone-link-hover"
              }`}
            >
              {tab.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The topic "select": a disclosure of links to topic pages (no client JavaScript). */
export function TopicLinks({ topics }: Readonly<{ topics: readonly TopicLink[] }>) {
  if (topics.length === 0) return null;
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer items-center gap-(--space-2) rounded-full border border-tone-control-border px-(--space-5) py-(--space-2) text-body text-tone-text">
        {insightsCopy.topics}
      </summary>
      <ul className="m-0 mt-(--space-2) grid list-none gap-(--space-2) rounded-2xl border border-tone-border bg-tone-bg p-(--space-5) sm:grid-cols-2">
        {topics.map((topic) => (
          <li key={topic.href}>
            <a
              href={topic.href}
              className="text-body text-tone-link underline-offset-4 hover:underline"
            >
              {topic.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Previous and next as text links with `rel`, and the position in mono. */
export function PaginationNav({ pagination }: Readonly<{ pagination: Pagination | null }>) {
  if (!pagination) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-(--space-8) flex items-center justify-between gap-(--space-4) border-t border-tone-border pt-(--space-5)"
    >
      {pagination.previous ? (
        <a
          href={pagination.previous}
          rel="prev"
          className="text-body text-tone-link underline underline-offset-4"
        >
          {insightsCopy.previous}
        </a>
      ) : (
        <span />
      )}
      <p className={`${monoLabel} m-0 text-tone-muted`}>
        Page {pagination.page} of {pagination.totalPages}
      </p>
      {pagination.next ? (
        <a
          href={pagination.next}
          rel="next"
          className="text-body text-tone-link underline underline-offset-4"
        >
          {insightsCopy.next}
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}

/**
 * The site's closing card (ClosingBand). On an article its primary action is the post's own call
 * to action when that is safe; otherwise Talk to Vitalos.
 */
export function TalkBand({ cta }: Readonly<{ cta?: { label: string; href: string } | undefined }>) {
  const href = cta ? safeCtaHref(cta.href) : undefined;
  return cta && href && cta.label.trim() ? (
    <ClosingBand primary={{ label: cta.label, href }} />
  ) : (
    <ClosingBand />
  );
}
