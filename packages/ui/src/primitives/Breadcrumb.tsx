import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./_internal/cx";
import { Icon } from "./Icon";

export interface BreadcrumbItem {
  label: string;
  /** Omit on the current page (the last item). */
  href?: string;
}

export interface BreadcrumbProps extends ComponentPropsWithoutRef<"nav"> {
  items: ReadonlyArray<BreadcrumbItem>;
}

/** Breadcrumb trail. The last item is the current page: text with aria-current, not a link. */
export function Breadcrumb({
  items,
  className,
  "aria-label": ariaLabel = "Breadcrumb",
  ...props
}: BreadcrumbProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={ariaLabel} className={className} {...props}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-(--space-2) gap-y-(--space-1) p-0 text-small">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-(--space-2)">
              {last || !item.href ? (
                <span
                  {...(last ? { "aria-current": "page" as const } : {})}
                  className="text-tone-muted"
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className={cx(
                    "text-tone-link underline underline-offset-4 hover:text-tone-link-hover",
                    // A 44px touch target below lg without changing the line's look.
                    "inline-flex min-h-11 items-center lg:min-h-0",
                  )}
                >
                  {item.label}
                </a>
              )}
              {last ? null : <Icon name="chevron-right" size={16} className="text-tone-muted" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
