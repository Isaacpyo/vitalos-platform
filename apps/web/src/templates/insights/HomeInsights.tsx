import type { SectionTone } from "@vitalos/ui";
import { insightsCopy, metaLine, postHref } from "../../features/content/insights/model";
import type { PostSummary } from "../../features/content/insights/model";
import { INSIGHTS_BASE } from "../../features/content/routes";
import type { HomeData } from "../../features/content/schemas";
import { Band } from "../commercial/bands";
import { isAllowedImage } from "../../features/content/markdown/render";
import { mediaOrigin } from "../../features/content/site-hosts";
import { CardArrow, cardFrame, cardLink, monoLabel } from "./card";

/**
 * The lead item's cover as a plain lazy image with its stored size (no layout shift). next/image
 * is not used here: importing it would load its client code on the homepage even when the band is
 * hidden (homepage JS budget).
 */
function HomeCover({
  image,
}: Readonly<{ image: { url: string; alt: string; width: number; height: number } }>) {
  if (!isAllowedImage(image.url, mediaOrigin())) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see above
    <img
      src={image.url}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
      className="aspect-video h-auto w-full rounded-xl object-cover"
    />
  );
}

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
      <article className={cardFrame}>
        {lead && post.cover ? <HomeCover image={post.cover} /> : null}
        <p className={`${monoLabel} m-0 text-tone-eyebrow`}>{post.format.label}</p>
        <h3 className={`m-0 text-tone-heading text-balance ${lead ? "text-h2" : "text-h3"}`}>
          <a href={postHref(post.slug)} className={cardLink}>
            {post.title}
          </a>
        </h3>
        <p className="m-0 line-clamp-2 text-body text-tone-text">{post.excerpt}</p>
        <div className="mt-auto flex items-end justify-between gap-(--space-4) pt-(--space-2)">
          <p className={`${monoLabel} m-0 text-tone-muted`}>{metaLine(post)}</p>
          <CardArrow />
        </div>
      </article>
    </li>
  );
}

/**
 * The homepage Insights section (brief 5.6), from the admin's `home` read, as a homepage band
 * (the section heading with the onward link, then the cards). Hidden entirely when the admin
 * returns no section (closed, disabled or nothing published). One or two items adapt without
 * gaps; tablet shows two columns, mobile a stacked list.
 */
export function HomeInsights({
  section,
  tone = "light",
}: Readonly<{ section: HomeData["insights"]; tone?: SectionTone }>) {
  if (!section || section.items.length === 0) return null;
  const count = section.items.length;
  return (
    <Band
      tone={tone}
      eyebrow={insightsCopy.eyebrow}
      heading={section.heading}
      intro={section.intro || undefined}
      link={{ label: insightsCopy.allInsights, href: INSIGHTS_BASE }}
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 md:grid-cols-2 lg:grid-cols-12">
        {section.items.map((post, index) => (
          <HomeInsightItem
            key={post.id}
            post={post}
            lead={index === 0}
            span={homeItemSpan(index, count)}
          />
        ))}
      </ul>
    </Band>
  );
}
