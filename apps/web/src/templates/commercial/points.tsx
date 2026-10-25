import type { LandingPoint } from "@vitalos/cms";
import { Disclosure, Icon, IconTile, RevealItem } from "@vitalos/ui";
import { pointIcon } from "../../lib/view-mapping/icons";

/**
 * Points of the lead and offer pages (Website Build Pack, revision 2): each an icon, a bold title
 * of up to six words and one supporting line, with an optional fact chip, sub-points and a closing
 * note. Layout only: every word comes from the view model or the labels passed in. Icons are
 * decorative (the title or line always says it) and hidden from assistive technology.
 */

const cx = (...classes: (string | false | undefined)[]): string =>
  classes.filter(Boolean).join(" ");

export interface PointCardLabels {
  /** Label above the sub-points, for example "You get". */
  points?: string | undefined;
  /** Label before the note, for example "Best for". Without one the note stands alone. */
  note?: string | undefined;
}

/** Grid columns from lg. Five items sit three over two, the second row centred. */
const gridClasses = (count: number, columns: 2 | 3 | 4 | undefined): string => {
  if (columns === 2) return "md:grid-cols-2";
  if (columns === 4) return "md:grid-cols-2 lg:grid-cols-4";
  if (count === 5)
    return "md:grid-cols-2 lg:grid-cols-6 lg:[&>li]:col-span-2 lg:[&>li:nth-child(4)]:col-start-2";
  if (count === 2 || count === 4) return "md:grid-cols-2";
  return "md:grid-cols-2 lg:grid-cols-3";
};

export interface PointGridProps {
  points: readonly LandingPoint[];
  /** Columns from lg; by default chosen from the number of points. */
  columns?: 2 | 3 | 4 | undefined;
  labels?: PointCardLabels | undefined;
  /** Number the cards (01, 02 ...) as the steps of a sequence, in an ordered list. */
  numbered?: boolean | undefined;
}

export function PointGrid({ points, columns, labels, numbered }: Readonly<PointGridProps>) {
  if (points.length === 0) return null;
  const List = numbered ? "ol" : "ul";
  return (
    <List
      className={cx(
        "m-0 grid list-none grid-cols-1 gap-(--space-4) p-0",
        gridClasses(points.length, columns),
      )}
    >
      {points.map((point, index) => (
        <RevealItem as="li" key={`${point.key}-${index}`} className="min-w-0">
          <PointCard point={point} labels={labels} {...(numbered ? { number: index + 1 } : {})} />
        </RevealItem>
      ))}
    </List>
  );
}

/** A short status or duration chip beside a card's icon. */
export function Chip({ children }: Readonly<{ children: string }>) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-tone-border px-(--space-3) py-(--space-1) text-small font-semibold text-tone-text">
      {children}
    </span>
  );
}

/**
 * One point as a card. With `href`, the title is the link and its hit area covers the card, so the
 * link's accessible name is the title alone.
 */
export function PointCard({
  point,
  labels,
  number,
  className,
}: Readonly<{
  point: LandingPoint;
  labels?: PointCardLabels | undefined;
  number?: number | undefined;
  className?: string | undefined;
}>) {
  const linked = Boolean(point.href);
  return (
    <div
      className={cx(
        "group relative flex h-full min-w-0 flex-col gap-(--space-4) rounded-2xl border border-tone-border bg-tone-bg p-(--space-6)",
        linked &&
          "transition-[translate,border-color,box-shadow] duration-(--duration-reveal) ease-(--ease-standard) hover:-translate-y-1 hover:border-blue-600/60 hover:shadow-floating",
        className,
      )}
    >
      <span className="flex items-start justify-between gap-(--space-3)">
        <IconTile name={pointIcon(point.key)} />
        {point.meta ? <Chip>{point.meta}</Chip> : null}
        {number !== undefined && !point.meta ? (
          <span aria-hidden="true" className="font-mono text-small text-tone-muted">
            {String(number).padStart(2, "0")}
          </span>
        ) : null}
      </span>
      <span className="block min-w-0">
        {point.title ? (
          <h3 className="m-0 text-h3 text-balance text-tone-heading">
            {number !== undefined && point.meta ? (
              <span className="mr-(--space-2) font-mono text-tone-muted">
                {String(number).padStart(2, "0")}
              </span>
            ) : null}
            {point.href ? (
              <a
                href={point.href}
                className="text-inherit no-underline after:absolute after:inset-0 after:rounded-2xl after:content-['']"
              >
                {point.title}
              </a>
            ) : (
              point.title
            )}
          </h3>
        ) : null}
        <span
          className={cx(
            "block text-pretty text-tone-text",
            point.title ? "mt-(--space-2) text-body" : "text-body-l",
          )}
        >
          {point.text}
        </span>
      </span>
      {point.points && point.points.length > 0 ? (
        <span className="block">
          {labels?.points ? (
            <span className="block text-small font-semibold text-tone-heading">
              {labels.points}
            </span>
          ) : null}
          <SubPoints points={point.points} />
        </span>
      ) : null}
      {point.note ? (
        <p className="m-0 mt-auto border-t border-tone-border pt-(--space-4) text-small text-tone-text">
          {labels?.note ? <span className="font-semibold">{labels.note}: </span> : null}
          {point.note}
        </p>
      ) : null}
      {linked ? (
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex size-10 shrink-0 items-center justify-center self-start rounded-full border border-tone-border text-tone-link transition-[translate,border-color,background-color,color] duration-(--duration-reveal) ease-(--ease-standard) group-hover:translate-x-1 group-hover:border-transparent group-hover:bg-tone-action group-hover:text-tone-action-text",
            !point.note && "mt-auto",
          )}
        >
          <Icon name="arrow-right" size={16} />
        </span>
      ) : null}
    </div>
  );
}

/** A card's sub-points: a small icon and a few words each. */
export function SubPoints({ points }: Readonly<{ points: readonly LandingPoint[] }>) {
  return (
    <ul className="m-0 mt-(--space-2) grid list-none gap-(--space-2) p-0">
      {points.map((sub, index) => (
        <li
          key={`${sub.key}-${index}`}
          className="flex items-start gap-(--space-2) text-small text-tone-text"
        >
          <Icon name={pointIcon(sub.key)} size={16} className="mt-0.5 shrink-0 text-tone-tile-fg" />
          <span className="min-w-0">{sub.text}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Points as rows of a small icon tile beside a bold title and its line (or the line alone), for a
 * list read top to bottom: the dark callout's columns, the trust points, short requirement lists.
 */
export function PointRows({
  points,
  columns = 1,
}: Readonly<{ points: readonly LandingPoint[]; columns?: 1 | 2 | 3 | undefined }>) {
  if (points.length === 0) return null;
  return (
    <ul
      className={cx(
        "m-0 grid list-none grid-cols-1 gap-x-(--space-7) p-0",
        columns === 2 && "md:grid-cols-2",
        columns === 3 && "md:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {points.map((point, index) => (
        <RevealItem
          as="li"
          key={`${point.key}-${index}`}
          className="flex min-w-0 items-start gap-(--space-4) border-t border-tone-border py-(--space-4)"
        >
          <IconTile name={pointIcon(point.key)} size="sm" />
          <span className="block min-w-0">
            {point.title ? (
              <h3 className="m-0 text-body-l font-semibold text-balance text-tone-heading">
                {point.title}
              </h3>
            ) : null}
            <span
              className={cx(
                "block text-pretty text-tone-text",
                point.title ? "mt-(--space-1) text-body" : "mt-(--space-1) text-body-l",
              )}
            >
              {point.text}
            </span>
          </span>
        </RevealItem>
      ))}
    </ul>
  );
}

/** Questions and answers as an accordion (FAQPage structured data is emitted by the route). */
export function FaqList({
  entries,
}: Readonly<{ entries: readonly { question: string; answer: string }[] }>) {
  return (
    <div className="max-w-(--container-content)">
      {entries.map((entry, index) => (
        <Disclosure key={`${entry.question}-${index}`} summary={entry.question}>
          <p className="m-0 text-body text-tone-text">{entry.answer}</p>
        </Disclosure>
      ))}
    </div>
  );
}
