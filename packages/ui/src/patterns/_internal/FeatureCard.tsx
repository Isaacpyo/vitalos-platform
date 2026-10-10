import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { CircleArrow } from "../../primitives/CircleArrow";
import type { HeadingSize } from "../../primitives/Heading";
import type { IconName } from "../../primitives/Icon";
import { IconTile } from "../../primitives/IconTile";
import { MetaRow, type MetaItem } from "../../primitives/MetaRow";
import { MediaPlaceholder, type MediaPlaceholderVariant } from "../media/MediaPlaceholder";
import { CardTitle } from "./CardTitle";
import { PatternMedia } from "./Media";
import { hasText, type ItemHeadingLevel, type PatternImage } from "./types";

/** Props shared by the cards (solution, link). */
export interface CardBaseProps {
  title: string;
  href: string;
  summary?: string | undefined;
  /** Small classification above the title, for example the kind of content. */
  eyebrow?: string | undefined;
  meta?: readonly MetaItem[] | undefined;
  /** Optional. The card is complete without an image. */
  image?: PatternImage | undefined;
  /**
   * Without an image, shows the decorative token placeholder in the image slot (the comp's
   * photo cards). Omit for a card with no media area.
   */
  placeholder?: MediaPlaceholderVariant | undefined;
  /** Decorative subject icon on a tinted tile, above the title. */
  icon?: IconName | undefined;
  /** h3 (default) or h4 for dense grids of four or more. */
  titleSize?: Extract<HeadingSize, "h3" | "h4"> | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

interface FeatureCardProps extends CardBaseProps {
  kind?: string;
  children?: ReactNode;
}

/**
 * Bordered card with one stretched link (the title), from the owner comp: optional media or a
 * token placeholder, an icon tile, the title, a short summary and an arrow disc. Hover lifts the
 * card slightly and colours the edge; no resting shadow (Stage 9 section 8). Fills its grid
 * cell; content decides the height.
 */
export function FeatureCard({
  title,
  href,
  summary,
  eyebrow,
  meta,
  image,
  placeholder,
  icon,
  titleSize = "h3",
  headingLevel = 3,
  className,
  kind,
  children,
}: FeatureCardProps) {
  return (
    <article
      {...(kind ? { "data-kind": kind } : {})}
      className={cx(
        "group relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-tone-border bg-tone-bg",
        // Hover and keyboard focus feedback alike (Stage 9 section 11: 100 to 180ms): a 4px lift,
        // the action-coloured edge and the arrow sliding through its disc. Colour only under
        // reduced motion.
        "transition-[border-color,translate] duration-(--duration-feedback) ease-(--ease-emphasis)",
        "hover:-translate-y-1 hover:border-tone-action focus-within:-translate-y-1 focus-within:border-tone-action",
        "motion-reduce:hover:translate-y-0 motion-reduce:focus-within:translate-y-0",
        className,
      )}
    >
      {image ? (
        <PatternMedia image={image} className="aspect-[3/2]" />
      ) : placeholder !== undefined ? (
        <MediaPlaceholder variant={placeholder} className="aspect-[16/9]" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-(--space-3) p-(--space-5)">
        {icon ? (
          <IconTile
            name={icon}
            className={cx(
              "mb-(--space-1)",
              placeholder !== undefined && !image && "relative -mt-11 border-4 border-tone-bg",
            )}
          />
        ) : null}
        {hasText(eyebrow) ? (
          <p className="text-eyebrow text-tone-muted uppercase">{eyebrow}</p>
        ) : null}
        <CardTitle level={headingLevel} size={titleSize} href={href}>
          {title}
        </CardTitle>
        {hasText(summary) ? (
          <p
            className={cx(
              "text-tone-text text-pretty",
              titleSize === "h4" ? "text-small" : "text-body",
            )}
          >
            {summary}
          </p>
        ) : null}
        {meta && meta.length > 0 ? <MetaRow items={meta} /> : null}
        {children}
        <div className="mt-auto pt-(--space-2)">
          <CircleArrow />
        </div>
      </div>
    </article>
  );
}
