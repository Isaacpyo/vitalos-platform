import { cx } from "../../primitives/_internal/cx";
import { Button } from "../../primitives/Button";
import { Icon } from "../../primitives/Icon";
import { quietLinkClasses } from "./nav-styles";
import type { SiteNavItem, SiteNavLink } from "./types";
import type { PatternLink } from "../_internal/types";

export interface MobileNavProps {
  items: readonly SiteNavItem[];
  /** Lower-emphasis utility links (for example the Trust Centre). */
  utility?: readonly SiteNavLink[] | undefined;
  /**
   * The persistent primary action, passed in (never hard-coded). Shown beside the trigger in the
   * compact bar when there is room (448px and up) and otherwise as the first item of the open panel.
   */
  cta?: PatternLink | undefined;
  /** Visible label of the menu trigger. */
  menuLabel?: string | undefined;
  /** Accessible name of the navigation landmark. */
  "aria-label"?: string | undefined;
  /** Key of the current section: `aria-current` plus a bold weight. */
  activeKey?: string | undefined;
  /** Render the panel open on first paint (Storybook, documentation). Users toggle it natively. */
  defaultOpen?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Compact-viewport navigation built from native `<details>`: it opens, closes and exposes
 * expanded state with NO JavaScript. Sections with a menu become nested disclosures whose first
 * link is the section index, so no destination is only reachable through a flyout. The panel is
 * positioned against the nearest positioned ancestor (the sticky header) and scrolls on short
 * screens. Visible at every width on its own; SiteHeader hides it from the `lg` breakpoint, where the desktop
 * navigation takes over.
 */
export function MobileNav({
  items,
  utility,
  cta,
  menuLabel = "Menu",
  "aria-label": ariaLabel = "Primary",
  activeKey,
  defaultOpen,
  className,
}: MobileNavProps) {
  return (
    <div className={cx("flex items-center gap-(--space-3)", className)}>
      {cta ? (
        <div className="hidden min-[28rem]:block">
          <Button href={cta.href} size="sm">
            {cta.label}
          </Button>
        </div>
      ) : null}
      <details className="group" open={defaultOpen}>
        <summary
          className={cx(
            "flex min-h-(--size-button-md) cursor-pointer list-none items-center gap-(--space-2) rounded-sm whitespace-nowrap",
            "border border-tone-heading px-(--space-3) text-body font-semibold text-tone-heading",
            "marker:hidden [&::-webkit-details-marker]:hidden",
          )}
        >
          <span>{menuLabel}</span>
          <Icon name="menu" size={20} className="group-open:hidden" />
          <Icon name="close" size={20} className="hidden group-open:block" />
        </summary>
        <nav
          aria-label={ariaLabel}
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--size-header))] overflow-y-auto border-b border-tone-border bg-tone-bg px-(--gutter) py-(--space-5) shadow-floating"
        >
          {cta ? (
            <div className="mb-(--space-5) min-[28rem]:hidden">
              <Button href={cta.href} size="lg" className="w-full">
                {cta.label}
              </Button>
            </div>
          ) : null}
          <ul className="m-0 list-none p-0">
            {items.map((item) => (
              <MobileItem key={item.key} item={item} active={item.key === activeKey} />
            ))}
          </ul>
          {utility && utility.length > 0 ? (
            <ul className="m-0 mt-(--space-2) list-none p-0">
              {utility.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={cx(quietLinkClasses, "block py-(--space-3) text-body font-medium")}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </nav>
      </details>
    </div>
  );
}

function MobileItem({ item, active }: { item: SiteNavItem; active: boolean }) {
  const columns = (item.menu?.columns ?? []).filter((column) => column.links.length > 0);
  const current = active ? ({ "aria-current": "true" } as const) : {};
  const rowClasses = cx(
    "text-body text-tone-heading",
    active ? "font-semibold underline decoration-2 underline-offset-4" : "font-medium",
  );

  if (columns.length === 0) {
    return (
      <li className="border-b border-tone-border">
        <a
          href={item.href}
          {...current}
          className={cx(
            rowClasses,
            "flex min-h-(--size-button-md) items-center py-(--space-3) no-underline",
          )}
        >
          {item.label}
        </a>
      </li>
    );
  }

  return (
    <li className="border-b border-tone-border">
      <details className="group/section">
        <summary
          className={cx(
            "flex min-h-(--size-button-md) cursor-pointer list-none items-center justify-between gap-(--space-3) py-(--space-3)",
            rowClasses,
            "marker:hidden [&::-webkit-details-marker]:hidden",
          )}
        >
          <span>{item.label}</span>
          <Icon
            name="chevron-down"
            size={20}
            className="shrink-0 transition-transform duration-(--duration-disclosure) ease-(--ease-standard) group-open/section:rotate-180"
          />
        </summary>
        <div className="pb-(--space-4) pl-(--space-3)">
          <a
            href={item.href}
            {...current}
            className={cx(
              quietLinkClasses,
              "flex min-h-(--size-button-md) items-center gap-(--space-2) text-body font-semibold",
            )}
          >
            <span>{item.label}</span>
            <Icon name="arrow-right" size={16} />
          </a>
          {columns.map((column) => (
            <div key={column.key} className="mt-(--space-3)">
              <p className="text-eyebrow text-tone-muted uppercase">
                {column.href ? (
                  <a href={column.href} className="underline underline-offset-4">
                    {column.heading}
                  </a>
                ) : (
                  column.heading
                )}
              </p>
              <ul className="m-0 list-none p-0">
                {column.links.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <a
                      href={link.href}
                      className={cx(quietLinkClasses, "block py-(--space-2) text-body")}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </li>
  );
}
