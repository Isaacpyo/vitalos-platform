import { cx } from "../../primitives/_internal/cx";
import { Icon } from "../../primitives/Icon";
import type { ItemHeadingLevel, PatternLink } from "../_internal/types";
import { MaturityBadge, type MaturityKey } from "./MaturityBadge";

export interface LabShowcaseItem {
  title: string;
  href: string;
  /** The lab type, for example "Research". */
  eyebrow?: string | undefined;
  summary?: string | undefined;
  maturity: MaturityKey;
  /** Maturity in words (required on every asset; see MaturityBadge). */
  maturityLabel: string;
}

export interface LabShowcaseProps {
  items: readonly LabShowcaseItem[];
  /** The closing dark card: the Labs index, with the lab types as chips. */
  more?: (PatternLink & { types?: readonly string[] | undefined }) | undefined;
  headingLevel?: ItemHeadingLevel | undefined;
  className?: string | undefined;
}

/** A small molecule: nodes and the links between them (viewBox 0 0 120 120). */
const NODES = [
  [20, 30],
  [62, 18],
  [98, 44],
  [74, 82],
  [32, 88],
  [58, 52],
] as const;
const LINKS = [
  [0, 5],
  [1, 5],
  [2, 5],
  [3, 5],
  [4, 5],
  [0, 1],
  [2, 3],
] as const;

/**
 * The Labs band as a bench of specimen cards (owner direction, 15 Oct 2026). The first asset is
 * a large card, the next ones sit beside it, and a dark card closes the set with the lab types.
 * Each card shows its type, title, maturity in words (always visible, right under the title),
 * and summary, over a faint dot grid with a small molecule diagram. Hovering or focusing a card
 * lifts it, turns its border blue, draws the molecule's links and sweeps a scan line across it.
 * CSS only (no script): the server HTML is the finished state and reduced motion makes every
 * change instant. Each card is a link to its asset.
 */
export function LabShowcase({ items, more, headingLevel = 3, className }: LabShowcaseProps) {
  const Heading = `h${headingLevel}` as const;
  if (items.length === 0) return null;
  const [lead, ...rest] = items;
  return (
    <ul
      className={cx(
        "m-0 grid list-none gap-(--space-4) p-0 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]",
        className,
      )}
    >
      {lead ? (
        <li className={cx("min-w-0", (rest.length > 0 || more) && "lg:row-span-2")}>
          <SpecimenCard item={lead} Heading={Heading} large />
        </li>
      ) : null}
      {rest.map((item) => (
        <li key={item.href} className="min-w-0">
          <SpecimenCard item={item} Heading={Heading} />
        </li>
      ))}
      {more ? (
        <li className="min-w-0">
          <a
            href={more.href}
            data-tone="dark"
            className="group relative isolate flex h-full min-h-[11rem] flex-col justify-between overflow-hidden rounded-2xl bg-tone-bg p-(--space-6) text-tone-text no-underline"
          >
            <span
              aria-hidden="true"
              className="absolute -top-20 -right-16 -z-10 size-64 rounded-full bg-blue-600/35 blur-3xl transition-transform duration-(--duration-diagram) ease-(--ease-emphasis) group-hover:scale-125"
            />
            <span className="flex flex-wrap gap-(--space-2)">
              {(more.types ?? []).map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-white/20 px-(--space-3) py-1 text-small text-tone-text"
                >
                  {type}
                </span>
              ))}
            </span>
            <span className="mt-(--space-6) flex items-end justify-between gap-(--space-4)">
              <span className="text-h3 font-semibold text-tone-heading">{more.label}</span>
              <span
                aria-hidden="true"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-tone-action text-tone-action-text transition-transform duration-(--duration-reveal) ease-(--ease-standard) group-hover:translate-x-1"
              >
                <Icon name="arrow-right" size={20} />
              </span>
            </span>
          </a>
        </li>
      ) : null}
    </ul>
  );
}

function SpecimenCard({
  item,
  Heading,
  large = false,
}: {
  item: LabShowcaseItem;
  Heading: `h${ItemHeadingLevel}`;
  large?: boolean;
}) {
  return (
    <a
      href={item.href}
      className={cx(
        "group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-tone-border bg-tone-bg p-(--space-6) no-underline",
        "transition-[translate,border-color,box-shadow] duration-(--duration-reveal) ease-(--ease-standard)",
        "hover:-translate-y-1 hover:border-blue-600/60 hover:shadow-floating focus-visible:border-blue-600/60",
        large && "lg:p-(--space-8)",
      )}
    >
      {/* Faint dot grid, strongest in the top-right corner. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgb(36_87_255/0.16)_1px,transparent_0)] bg-[length:18px_18px] [mask-image:radial-gradient(circle_at_100%_0%,black,transparent_70%)]"
      />
      {/* The scan line: sweeps across once on hover or focus. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 -left-1/3 -z-10 w-1/3 -translate-x-full bg-linear-to-r from-transparent via-blue-600/10 to-transparent transition-transform duration-[1100ms] ease-(--ease-standard) group-hover:translate-x-[420%] group-focus-visible:translate-x-[420%]"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 120 120"
        className={cx(
          "absolute top-(--space-5) right-(--space-5) text-blue-600",
          large ? "size-28 lg:size-36" : "size-20",
        )}
        fill="none"
      >
        {LINKS.map(([from, to]) => {
          const a = NODES[from];
          const b = NODES[to];
          return (
            <line
              key={`${from}-${to}`}
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              className="[stroke-dashoffset:0.75] opacity-40 transition-[stroke-dashoffset,opacity] duration-(--duration-diagram) ease-(--ease-emphasis) group-hover:[stroke-dashoffset:0] group-hover:opacity-90 group-focus-visible:[stroke-dashoffset:0]"
            />
          );
        })}
        {NODES.map(([x, y], index) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={index === NODES.length - 1 ? 7 : 4.5}
            className={cx(
              "origin-center transition-[fill,scale] duration-(--duration-reveal) ease-(--ease-emphasis) [transform-box:fill-box]",
              index === NODES.length - 1
                ? "fill-blue-600 group-hover:scale-125"
                : "fill-blue-100 stroke-blue-600 [stroke-width:1.5] group-hover:fill-aqua-50",
            )}
          />
        ))}
      </svg>
      {item.eyebrow ? (
        <span className="text-eyebrow text-tone-link uppercase">{item.eyebrow}</span>
      ) : null}
      <span
        className={cx("block min-w-0", large ? "mt-(--space-10) lg:mt-auto" : "mt-(--space-8)")}
      >
        <Heading
          className={cx(
            "m-0 text-balance text-tone-heading",
            large ? "text-h2" : "text-h3",
            "max-w-[24ch]",
          )}
        >
          {item.title}
        </Heading>
        <MaturityBadge
          maturity={item.maturity}
          label={item.maturityLabel}
          className="mt-(--space-3)"
        />
        {item.summary ? (
          <span
            className={cx(
              "mt-(--space-4) block max-w-(--container-prose) text-pretty text-tone-text",
              large ? "text-body-l" : "text-body line-clamp-3",
            )}
          >
            {item.summary}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="mt-(--space-6) inline-flex size-11 items-center justify-center self-start rounded-full border border-tone-border text-tone-link transition-[translate,border-color,background-color,color] duration-(--duration-reveal) ease-(--ease-standard) group-hover:translate-x-1 group-hover:border-transparent group-hover:bg-tone-action group-hover:text-tone-action-text"
      >
        <Icon name="arrow-right" size={20} />
      </span>
    </a>
  );
}
