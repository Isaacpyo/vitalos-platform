import { Icon } from "@vitalos/ui";

/**
 * Card helpers shared by the Insights and Careers pages and their homepage bands. Kept apart from
 * `parts.tsx`, which imports next/image: a client module imported anywhere in a route's server
 * graph is loaded on that route, so the homepage bands import only from here (homepage JS budget).
 */

export const monoLabel = "font-mono text-eyebrow tracking-widest uppercase";

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
