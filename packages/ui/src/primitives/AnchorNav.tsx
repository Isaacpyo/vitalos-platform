import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";

export interface AnchorNavItem {
  /** Id of the target section (without the leading #). */
  id: string;
  label: string;
}

export interface AnchorNavProps extends ComponentPropsWithoutRef<"nav"> {
  items: ReadonlyArray<AnchorNavItem>;
  /** Id of the section currently in view, if the page tracks it. Marked aria-current. */
  currentId?: string;
}

/** Long-page section navigation as a list of fragment links. Renders nothing when empty. */
export function AnchorNav({
  items,
  currentId,
  className,
  "aria-label": ariaLabel = "On this page",
  ...props
}: AnchorNavProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={ariaLabel} className={className} {...props}>
      <ul className="m-0 flex list-none flex-wrap gap-x-(--space-5) gap-y-(--space-2) p-0">
        {items.map((item) => {
          const current = item.id === currentId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                {...(current ? { "aria-current": "location" as const } : {})}
                className={cx(
                  "inline-block py-(--space-1) text-body underline-offset-4 hover:text-tone-link-hover hover:underline",
                  current ? "font-semibold text-tone-heading underline" : "text-tone-link",
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
