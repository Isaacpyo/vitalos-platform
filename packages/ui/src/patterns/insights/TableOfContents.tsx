import { cx } from "../../primitives/_internal/cx";
import { hasText } from "../_internal/types";

export interface TocItem {
  /** Id of the target heading (without the leading #). */
  id: string;
  label: string;
  /** 2 (default) or 3: level 3 is indented beneath its level 2. */
  level?: 2 | 3 | undefined;
}

export interface TableOfContentsProps {
  items: readonly TocItem[];
  /** Id of the heading currently in view, if the page tracks it. Marked `aria-current`. */
  currentId?: string | undefined;
  /** Visible title and accessible name of the navigation. */
  label?: string | undefined;
  className?: string | undefined;
}

/** In-article contents. Static fragment links: works without JavaScript. Empty renders nothing. */
export function TableOfContents({
  items,
  currentId,
  label = "On this page",
  className,
}: TableOfContentsProps) {
  const valid = items.filter((item) => hasText(item.id) && hasText(item.label));
  if (valid.length === 0) return null;
  return (
    <nav aria-label={label} className={cx("min-w-0", className)}>
      <p className="text-eyebrow text-tone-muted uppercase">{label}</p>
      <ol className="m-0 mt-(--space-3) list-none border-l border-tone-border p-0">
        {valid.map((item) => {
          const current = item.id === currentId;
          return (
            <li key={item.id} className={item.level === 3 ? "pl-(--space-4)" : undefined}>
              <a
                href={`#${item.id}`}
                {...(current ? { "aria-current": "location" as const } : {})}
                className={cx(
                  "block py-(--space-1) pl-(--space-3) text-small underline-offset-4 hover:text-tone-link-hover hover:underline",
                  current ? "font-semibold text-tone-heading underline" : "text-tone-link",
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
