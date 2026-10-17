import Image from "next/image";
import { Container, Section } from "@vitalos/ui";
import { JsonLd } from "../../components/json-ld";
import { ShareMenu } from "../../components/share-menu";
import type { ArticlePageData } from "../../features/content/insights/load";
import {
  articleCta,
  articleDatesLine,
  authorHref,
  editorialNoteFor,
  insightsCopy,
  isOrganisationAuthor,
  postHref,
  showsToc,
} from "../../features/content/insights/model";
import type { PostDetail } from "../../features/content/insights/model";
import { isAllowedImage } from "../../features/content/markdown/render";
import { mediaOrigin } from "../../features/content/site-hosts";
import { Band } from "../commercial/bands";
import { PageMain } from "../institutional/page-main";
import { articleBodyClass } from "./body-styles";
import { CodeCopyButtons } from "./copy-buttons";
import { ContentImage, InsightsHero, PostGrid, TalkBand, monoLabel } from "./parts";
import type { JsonLdNode } from "../../features/seo/json-ld";

const BODY_ID = "article-body";

type Toc = ArticlePageData["body"]["toc"];

function TocList({ toc }: Readonly<{ toc: Toc }>) {
  return (
    <ol className="m-0 mt-(--space-3) list-none border-l border-tone-border p-0">
      {toc.map((entry) => (
        <li
          key={entry.id}
          className={
            entry.depth === 3 ? "pl-(--space-4)" : entry.depth === 4 ? "pl-(--space-6)" : ""
          }
        >
          <a
            href={`#${entry.id}`}
            className="block py-(--space-1) pl-(--space-3) text-small text-tone-link underline-offset-4 hover:underline"
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

const SYMBOL = { src: "/brand/vitalos-symbol.png", width: 128, height: 128 } as const;

/**
 * An author's photo, or their initials when there is none; an organisation author (the Vitalos
 * team) shows the Vitalos symbol in a square. Decorative: the name is beside it.
 */
function AuthorAvatar({
  author,
  size = "sm",
}: Readonly<{
  author: Pick<PostDetail["authors"][number], "avatar" | "initials" | "kind">;
  size?: "sm" | "lg";
}>) {
  const box = size === "lg" ? "size-14 text-body" : "size-10 text-small";
  if (isOrganisationAuthor(author)) {
    return (
      <span
        aria-hidden="true"
        data-author-symbol=""
        className={`flex ${box} shrink-0 items-center justify-center rounded-md border border-tone-border bg-white p-(--space-2)`}
      >
        <Image
          src={SYMBOL.src}
          alt=""
          width={SYMBOL.width}
          height={SYMBOL.height}
          sizes={size === "lg" ? "56px" : "40px"}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }
  if (author.avatar) {
    return (
      <ContentImage
        image={{ ...author.avatar, alt: "" }}
        sizes={size === "lg" ? "56px" : "40px"}
        className={`${box} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-tone-tile-bg font-mono font-semibold text-tone-tile-fg`}
    >
      {author.initials}
    </span>
  );
}

/** Byline: round photo or initials, linked name, role. */
function Byline({ post }: Readonly<{ post: PostDetail }>) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-(--space-6) gap-y-(--space-4) p-0">
      {post.authors.map((author) => (
        <li key={author.id} className="flex items-center gap-(--space-3)">
          <AuthorAvatar author={author} />
          <span className="flex flex-col">
            <a
              href={authorHref(author.slug)}
              className="text-body font-semibold text-tone-heading underline-offset-4 hover:underline"
            >
              {author.name}
            </a>
            <span className="text-small text-tone-muted">{author.roleTitle}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The hero media: the admin's cover (with its caption) when it is on the media host. The cover
 * is optional (brief 5.2), so an article without one has no hero media rather than a placeholder.
 */
function ArticleCover({ post }: Readonly<{ post: PostDetail }>) {
  if (post.cover && isAllowedImage(post.cover.url, mediaOrigin())) {
    return (
      <figure className="m-0">
        <ContentImage
          image={post.cover}
          priority
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="aspect-video h-auto w-full rounded-2xl object-cover"
        />
        {post.cover.caption ? (
          <figcaption className="mt-(--space-2) text-small text-tone-muted">
            {post.cover.caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }
  return null;
}

/** The cover is optional (brief 5.2): without an approved admin cover the hero has no media. */
const hasCover = (post: PostDetail): boolean =>
  post.cover !== null && isAllowedImage(post.cover.url, mediaOrigin());

export interface ArticleTemplateProps {
  data: ArticlePageData;
  /** Absolute canonical URL of the article (copy link, share link). */
  url: string;
  jsonLd: readonly (JsonLdNode | Record<string, unknown> | null)[];
}

/**
 * The article (brief 5.2) in the site's design: the compact dark hero (format, H1, dek, byline
 * and dates, the cover beside them), the rendered body with its contents list, the sources, the
 * editorial note, the authors, sharing, related posts and the closing card.
 */
export function ArticleTemplate({ data, url, jsonLd }: Readonly<ArticleTemplateProps>) {
  const { post, body, authors, state } = data;
  const toc = showsToc(body.toc) ? body.toc : [];
  const related = post.related.filter((item) => item.slug !== post.slug).slice(0, 3);
  const editorialNote = editorialNoteFor(post, state.insights);

  return (
    <PageMain>
      <JsonLd data={jsonLd as JsonLdNode[]} />
      <article aria-label={post.title}>
        <InsightsHero
          eyebrow={post.format.label}
          title={post.title}
          media={hasCover(post) ? <ArticleCover post={post} /> : undefined}
        >
          <div className="flex flex-col gap-(--space-4)">
            <Byline post={post} />
            <p className={`${monoLabel} m-0 text-tone-muted`}>{articleDatesLine(post)}</p>
          </div>
        </InsightsHero>

        <Section as="div" tone="light" spacing="default">
          <Container size="wide">
            <div className="grid gap-x-(--space-8) xl:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="min-w-0">
                {toc.length > 0 ? (
                  <details className="mb-(--space-6) border-y border-tone-border py-(--space-3) xl:hidden">
                    <summary className={`${monoLabel} cursor-pointer text-tone-heading`}>
                      {insightsCopy.onThisPage}
                    </summary>
                    <TocList toc={toc} />
                  </details>
                ) : null}
                <div
                  id={BODY_ID}
                  className={articleBodyClass}
                  // Sanitised by the site's one renderer (allowlist, no raw HTML).
                  dangerouslySetInnerHTML={{ __html: body.html }}
                />
                <CodeCopyButtons
                  rootId={BODY_ID}
                  label={insightsCopy.copyCode}
                  copiedLabel={insightsCopy.codeCopied}
                />

                {editorialNote ? (
                  <p className="mt-(--space-8) max-w-[68ch] border-y border-tone-border py-(--space-4) text-small text-tone-muted">
                    {editorialNote}
                  </p>
                ) : null}

                {authors.length > 0 ? (
                  <section
                    aria-labelledby="article-authors"
                    className="mt-(--space-8) max-w-[68ch]"
                  >
                    <h2 id="article-authors" className={`${monoLabel} m-0 text-tone-muted`}>
                      {authors.length === 1 ? "Author" : "Authors"}
                    </h2>
                    <ul className="m-0 mt-(--space-4) flex list-none flex-col gap-(--space-6) p-0">
                      {authors.map((author) => (
                        <li
                          key={author.slug}
                          className="border-t border-tone-border pt-(--space-4)"
                        >
                          <div className="flex items-center gap-(--space-4)">
                            <AuthorAvatar author={author} size="lg" />
                            <div>
                              <p className="m-0 text-body-l font-semibold text-tone-heading">
                                <a
                                  href={authorHref(author.slug)}
                                  className="text-tone-heading underline-offset-4 hover:underline"
                                >
                                  {author.name}
                                </a>
                              </p>
                              <p className="m-0 text-small text-tone-muted">{author.roleTitle}</p>
                            </div>
                          </div>
                          {author.bioHtml ? (
                            <div
                              className="mt-(--space-3) text-body [&_a]:text-tone-link [&_a]:underline [&_p]:my-(--space-2)"
                              dangerouslySetInnerHTML={{ __html: author.bioHtml }}
                            />
                          ) : null}
                          <a
                            href={authorHref(author.slug)}
                            className="mt-(--space-3) inline-block text-body text-tone-link underline underline-offset-4"
                          >
                            {insightsCopy.moreFrom(author.firstName)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <div className="mt-(--space-7)">
                  <ShareMenu url={url} title={post.title} menuLabel={insightsCopy.shareMenu} />
                </div>
              </div>

              {toc.length > 0 ? (
                <aside className="hidden xl:block">
                  <nav
                    aria-label="On this page"
                    className="sticky top-[calc(var(--size-header)+var(--space-4))]"
                  >
                    <p className={`${monoLabel} m-0 text-tone-muted`}>{insightsCopy.onThisPage}</p>
                    <TocList toc={toc} />
                  </nav>
                </aside>
              ) : null}
            </div>
          </Container>
        </Section>
      </article>

      {related.length > 0 ? (
        <Band tone="muted" heading={insightsCopy.related}>
          <PostGrid posts={related} covers={false} headingLevel={3} />
        </Band>
      ) : null}

      <TalkBand cta={articleCta(post)} />
    </PageMain>
  );
}

export const articlePath = (post: Pick<PostDetail, "slug">): string => postHref(post.slug);
