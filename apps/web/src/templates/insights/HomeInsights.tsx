import { useId } from "react";
import { Button, Container, Section } from "@vitalos/ui";
import type { SectionTone } from "@vitalos/ui";
import { insightsCopy, metaLine, postHref } from "../../features/content/insights/model";
import type { PostSummary } from "../../features/content/insights/model";
import { INSIGHTS_BASE } from "../../features/content/routes";
import type { HomeData } from "../../features/content/schemas";
import { ContentImage, WithFullStop, monoLabel } from "./parts";

/** Grid placement per item: the first spans 6 of 12 columns, the next two 3 each (brief 5.6). */
export function homeItemSpan(index: number, count: number): string {
  if (count === 1) return "lg:col-span-12";
  if (index === 0) return "lg:col-span-6";
  // Two items share the row evenly; three or four put the rest in 3-column cells.
  return count === 2 ? "lg:col-span-6" : "lg:col-span-3";
}

function HomeInsightItem({
  post,
  lead,
  span,
}: Readonly<{ post: PostSummary; lead: boolean; span: string }>) {
  return (
    <li className={`min-w-0 ${span}`}>
      <article className="group relative flex h-full flex-col gap-(--space-3) border-t border-tone-border pt-(--space-5)">
        {lead && post.cover ? (
          <ContentImage image={post.cover} sizes="(min-width: 1024px) 50vw, 100vw" />
        ) : null}
        <p className={`${monoLabel} m-0 text-tone-eyebrow`}>{post.format.label}</p>
        <h3 className={`m-0 text-tone-heading text-balance ${lead ? "text-h2" : "text-h3"}`}>
          <a
            href={postHref(post.slug)}
            className="after:absolute after:inset-0 hover:text-tone-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus"
          >
            {post.title}
          </a>
        </h3>
        <p className="m-0 line-clamp-2 text-body text-tone-muted">{post.excerpt}</p>
        <p className={`${monoLabel} m-0 mt-auto text-tone-muted`}>{metaLine(post)}</p>
      </article>
    </li>
  );
}

/**
 * The homepage Insights section (brief 5.6), from the admin's `home` read. Hidden entirely when
 * the admin returns no section (closed, disabled or nothing published). One or two items adapt
 * without gaps; tablet shows two columns, mobile a stacked list with hairlines.
 */
export function HomeInsights({
  section,
  tone = "light",
}: Readonly<{ section: HomeData["insights"]; tone?: SectionTone }>) {
  const headingId = useId();
  if (!section || section.items.length === 0) return null;
  const count = section.items.length;
  return (
    <Section tone={tone} spacing="default" aria-labelledby={headingId}>
      <Container size="wide">
        <div className="flex flex-wrap items-end justify-between gap-(--space-5)">
          <div className="max-w-(--container-prose)">
            <p className={`${monoLabel} m-0 text-tone-eyebrow`}>{insightsCopy.eyebrow}</p>
            <h2 id={headingId} className="mt-(--space-3) text-h2 text-tone-heading text-balance">
              <WithFullStop text={section.heading} />
            </h2>
            {section.intro ? (
              <p className="mt-(--space-4) text-body-l text-tone-muted">{section.intro}</p>
            ) : null}
          </div>
          <Button href={INSIGHTS_BASE} variant="text" arrow>
            {insightsCopy.allInsights}
          </Button>
        </div>
        <ul className="m-0 mt-(--space-7) grid list-none grid-cols-1 gap-x-(--space-6) gap-y-(--space-6) p-0 md:grid-cols-2 lg:grid-cols-12">
          {section.items.map((post, index) => (
            <HomeInsightItem
              key={post.id}
              post={post}
              lead={index === 0}
              span={homeItemSpan(index, count)}
            />
          ))}
        </ul>
      </Container>
    </Section>
  );
}
