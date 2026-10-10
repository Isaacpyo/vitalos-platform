import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./_internal/cx";

export interface DefinitionItem {
  term: ReactNode;
  description: ReactNode;
}

export interface DefinitionListProps extends ComponentPropsWithoutRef<"dl"> {
  items: ReadonlyArray<DefinitionItem>;
}

/**
 * Terms and descriptions separated by rules: engagement summaries, trust properties, technical
 * attributes. Stacks on mobile, two columns from the md breakpoint. Renders nothing when empty.
 */
export function DefinitionList({ items, className, ...props }: DefinitionListProps) {
  if (items.length === 0) return null;
  return (
    <dl className={cx("m-0", className)} {...props}>
      {items.map((item, index) => (
        <div
          key={index}
          className="grid gap-(--space-1) border-t border-tone-border py-(--space-4) md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-(--space-5)"
        >
          <dt className="text-body font-semibold text-tone-heading">{item.term}</dt>
          <dd className="m-0 text-body text-tone-text">{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
