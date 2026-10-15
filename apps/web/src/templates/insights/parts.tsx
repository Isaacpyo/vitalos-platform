import Image from "next/image";
import type { ReactNode } from "react";
import { ctas } from "@vitalos/cms";
import { Container, Section, TerminalCTA } from "@vitalos/ui";
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
import { contactHref } from "../../lib/view-mapping/hrefs";

/**
 * Building blocks of the Insights pages (brief 5.1 to 5.6). Server components, design tokens
 * only (no raw colours), radius 0 and hairlines instead of shadows.
 */

export const monoLabel = "font-mono text-eyebrow tracking-widest uppercase";

/** A heading whose closing full stop is set in the action colour, as the site sets accents. */
export function WithFullStop({ text }: Readonly<{ text: string }>) {
  const trimmed = text.trimEnd();
  if (!trimmed.endsWith(".")) return <>{trimmed}</>;
  return (
    <>
      {trimmed.slice(0, -1)}
      <span className="text-tone-link">.</span>
    </>
  );
}

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
      className={className ?? "aspect-video h-auto w-full object-cover"}
    />
  );
}

/** The Insights hero: eyebrow, H1 with its full stop, intro. */
export function InsightsHero({
  eyebrow = insightsCopy.eyebrow,
  title,
  intro,
  children,
}: Readonly<{
  eyebrow?: string;
  title: string;
  intro?: string | undefined;
  children?: ReactNode;
}>) {
  return (
    <Section as="div" tone="light" spacing="default" className="border-b border-tone-border">
      <Container size="wide">
        <p className={`${monoLabel} m-0 text-tone-eyebrow`}>{eyebrow}</p>
        <h1 className="mt-(--space-3) max-w-(--container-content) text-display-l break-words text-tone-heading text-balance">
          <WithFullStop text={title} />
        </h1>
        {intro ? (
          <p className="mt-(--space-5) max-w-(--container-prose) text-body-l text-tone-muted">
            {intro}
          </p>
        ) : null}
        {children}
      </Container>
    </Section>
  );
}

/** One grid item: mono format tag, title (the link covers the item), excerpt, mono meta. */
export function PostCard({
  post,
  headingLevel = 2,
  showCover,
}: Readonly<{ post: PostSummary; headingLevel?: 2 | 3; showCover: boolean }>) {
  const Title = `h${headingLevel}` as "h2";
  return (
    <article className="group relative flex h-full min-w-0 flex-col gap-(--space-3) border-t border-tone-border pt-(--space-5)">
      {showCover && post.cover ? (
        <ContentImage
          image={post.cover}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
      ) : null}
      <p className={`${monoLabel} m-0 text-tone-eyebrow`}>{post.format.label}</p>
      <Title className="m-0 text-h3 text-tone-heading text-balance">
        <a
          href={postHref(post.slug)}
          className="after:absolute after:inset-0 hover:text-tone-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus"
        >
          {post.title}
        </a>
      </Title>
      <p className="m-0 line-clamp-3 text-body text-tone-muted">{post.excerpt}</p>
      <p className={`${monoLabel} m-0 mt-auto text-tone-muted`}>{metaLine(post)}</p>
    </article>
  );
}

/** 3 columns at 1024px and up, 2 from 640px, 1 below; hairlines between items. */
export function PostGrid({
  posts,
  covers,
  headingLevel = 2,
}: Readonly<{ posts: readonly PostSummary[]; covers: boolean; headingLevel?: 2 | 3 }>) {
  if (posts.length === 0) return null;
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-x-(--space-6) gap-y-(--space-7) p-0 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <li key={post.id} className="min-w-0">
          <PostCard post={post} showCover={covers} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}

/** The featured post as a full-width row: cover 7 of 12 columns (when it has one), text 5. */
export function FeaturedPost({ post }: Readonly<{ post: PostSummary }>) {
  return (
    <article className="group relative grid min-w-0 gap-(--space-6) border-y border-tone-border py-(--space-7) lg:grid-cols-12 lg:items-center">
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
          <a
            href={postHref(post.slug)}
            className="after:absolute after:inset-0 hover:text-tone-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus"
          >
            {post.title}
          </a>
        </h2>
        <p className="m-0 text-body-l text-tone-muted">{post.excerpt}</p>
        <p className={`${monoLabel} m-0 text-tone-muted`}>{metaLine(post)}</p>
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
      <summary className="inline-flex cursor-pointer items-center gap-(--space-2) border border-tone-control-border px-(--space-4) py-(--space-2) text-body text-tone-text">
        {insightsCopy.topics}
      </summary>
      <ul className="m-0 mt-(--space-2) grid list-none gap-(--space-2) border border-tone-border bg-tone-bg p-(--space-4) sm:grid-cols-2">
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

/** The site's closing "Talk to Vitalos" band, or the post's own call to action. */
export function TalkBand({ cta }: Readonly<{ cta?: { label: string; href: string } | undefined }>) {
  const href = cta ? safeCtaHref(cta.href) : undefined;
  const primary =
    cta && href && cta.label.trim()
      ? { label: cta.label, href }
      : { label: ctas.primary, href: contactHref() };
  return <TerminalCTA heading={insightsCopy.talkToVitalos} primary={primary} />;
}

/** A band of the page body: section plus container, named by its heading when it has one. */
export function Band({
  children,
  labelledBy,
  className,
}: Readonly<{ children: ReactNode; labelledBy?: string; className?: string }>) {
  return (
    <Section
      tone="light"
      spacing="default"
      {...(labelledBy ? { "aria-labelledby": labelledBy } : { as: "div" as const })}
      {...(className ? { className } : {})}
    >
      <Container size="wide">{children}</Container>
    </Section>
  );
}
