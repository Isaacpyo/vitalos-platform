"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { Transition } from "motion/react";
import * as m from "motion/react-m";
import {
  MotionIsland,
  prefersReducedMotion,
  useMotionAllowed,
} from "../../motion/_internal/island";
import { cx } from "../../primitives/_internal/cx";
import { Button } from "../../primitives/Button";
import { Icon } from "../../primitives/Icon";
import { SocialLinks, type SocialLink } from "./SocialLinks";
import { quietLinkClasses } from "./nav-styles";
import type { MegaMenuColumn, SiteNavItem, SiteNavLink } from "./types";
import type { PatternLink } from "../_internal/types";

export interface MobileNavProps {
  items: readonly SiteNavItem[];
  /** Lower-emphasis utility links, in their own row of the sheet. */
  utility?: readonly SiteNavLink[] | undefined;
  /** Social profiles, as a row of marks at the foot of the sheet. */
  social?: readonly SocialLink[] | undefined;
  /** The persistent primary action, passed in (never hard-coded). Always beside the trigger. */
  cta?: PatternLink | undefined;
  /** Visible label of the menu trigger. */
  menuLabel?: string | undefined;
  /** Accessible name of the navigation landmark. */
  "aria-label"?: string | undefined;
  /** Key of the current section: `aria-current` plus a bold weight and underline. */
  activeKey?: string | undefined;
  /** Render the sheet open on first paint (Storybook, documentation). */
  defaultOpen?: boolean | undefined;
  className?: string | undefined;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), summary, input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * True for anything inside a closed `<details>` other than that disclosure's own summary. Chrome
 * hides closed disclosure content with `content-visibility`, so those links still have layout
 * boxes and would otherwise count as the trap's last stop, letting Tab escape the sheet.
 */
function insideClosedDisclosure(element: HTMLElement): boolean {
  const closed = element.closest("details:not([open])");
  if (!closed) return false;
  return !(element.tagName === "SUMMARY" && element.parentElement === closed);
}

/** Settles in about 220ms (Stage 9 section 11, panel reveal 160 to 240ms). */
const sheetSpring: Transition = { type: "spring", stiffness: 520, damping: 44, mass: 0.9 };

/**
 * Compact-viewport navigation (below lg): a sheet under the sticky header.
 *
 * Built on a native `<details>`, so without JavaScript it still opens, closes and exposes its
 * expanded state. With JavaScript the same element is enhanced:
 * - the sheet fills the viewport under the header and slides in on a short spring (no opacity on
 *   text; instant under reduced motion);
 * - focus is trapped in the trigger and the sheet, everything else on the page is `inert`, page
 *   scrolling is locked, Escape closes, and focus returns to the trigger;
 * - it closes itself when the viewport grows into the desktop navigation.
 *
 * Phones (below md): one column; a section with a menu is a nested disclosure whose first link is
 * the section index, so no destination is only reachable through a flyout. Tablets (md to lg):
 * a two-column sheet, the primary rows on the left and every section's groups open on the right.
 * The utility links sit in a lower-emphasis row at the end. Every row is at least 44px high.
 */
export function MobileNav(props: MobileNavProps) {
  return (
    <MotionIsland>
      <MobileNavInner {...props} />
    </MotionIsland>
  );
}

function MobileNavInner({
  items,
  utility,
  social,
  cta,
  menuLabel = "Menu",
  "aria-label": ariaLabel = "Primary",
  activeKey,
  defaultOpen,
  className,
}: MobileNavProps) {
  const [open, setOpen] = useState(defaultOpen === true);
  const [openings, setOpenings] = useState(0);
  const motionAllowed = useMotionAllowed();
  const rootRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) summaryRef.current?.focus();
  }, []);

  const onSummaryClick = (event: MouseEvent<HTMLElement>) => {
    // Take over the native toggle so the open state lives in React (focus trap, inert, motion).
    event.preventDefault();
    if (open) {
      close(false);
    } else {
      setOpenings((count) => count + 1);
      setOpen(true);
    }
  };

  // Modal behaviour while open (JavaScript only; the native disclosure has none of it).
  useEffect(() => {
    if (!open || defaultOpen) return;
    const root = rootRef.current;
    if (!root) return;

    const madeInert: HTMLElement[] = [];
    let node: HTMLElement | null = root;
    // Make inert every sibling of every ancestor of the menu, up to <body>: the rest of the
    // header, the skip link, the page, the footer.
    while (node && node !== document.body) {
      const parent: HTMLElement | null = node.parentElement;
      if (parent) {
        for (const sibling of Array.from(parent.children)) {
          if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert) {
            sibling.inert = true;
            madeInert.push(sibling);
          }
        }
      }
      node = parent;
    }
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    // The trap covers everything this component renders, in document order: the bar's primary
    // action, the trigger and the sheet. The rest of the page is inert.
    const focusables = () =>
      Array.from(root.querySelectorAll(FOCUSABLE))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
        .filter((element) => !insideClosedDisclosure(element))
        .filter((element) => element.getClientRects().length > 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !root.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // The desktop navigation takes over from lg: never leave a modal sheet open behind it.
    const desktop =
      typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 64rem)") : null;
    const onDesktop = () => {
      if (!desktop?.matches) return;
      const hadFocus = root.contains(document.activeElement);
      // Lift inertness now (the effect cleanup repeats it) so focus can move straight away.
      for (const element of madeInert) element.inert = false;
      close(false);
      // The trigger disappears at lg: hand focus to the first control of the desktop header
      // (the wordmark) rather than letting it fall to <body>.
      if (hadFocus) {
        const header = root.closest("header");
        const target = Array.from(header?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).find(
          (element) => !root.contains(element) && element.getClientRects().length > 0,
        );
        target?.focus();
      }
    };
    desktop?.addEventListener("change", onDesktop);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop?.removeEventListener("change", onDesktop);
      for (const element of madeInert) element.inert = false;
      html.style.overflow = previousOverflow;
    };
  }, [open, defaultOpen, close]);

  const animate = motionAllowed && openings > 0 && !prefersReducedMotion();
  const groups = items.flatMap((item) => {
    const columns = visibleColumns(item);
    return columns.length > 0 ? [{ item, columns }] : [];
  });

  return (
    <div
      ref={rootRef}
      className={cx("flex items-center gap-(--space-2) sm:gap-(--space-3)", className)}
    >
      {cta ? (
        <Button
          href={cta.href}
          size="sm"
          className="whitespace-nowrap max-lg:min-h-11 max-[27.99rem]:px-(--space-3) max-[27.99rem]:text-small"
        >
          {cta.label}
        </Button>
      ) : null}
      {/* `data-mobile-nav-sheet` lets page chrome react to the sheet being open (neutral hook). */}
      <details className="group" open={open} data-mobile-nav-sheet="">
        <summary
          ref={summaryRef}
          onClick={onSummaryClick}
          className={cx(
            "flex min-h-11 cursor-pointer list-none items-center gap-(--space-1) rounded-sm whitespace-nowrap sm:min-h-(--size-button-md) sm:gap-(--space-2)",
            "border border-tone-heading px-(--space-2) text-small font-semibold text-tone-heading sm:px-(--space-3) sm:text-body",
            "marker:hidden [&::-webkit-details-marker]:hidden",
          )}
        >
          <span>{menuLabel}</span>
          <Icon name="menu" size={20} className="group-open:hidden max-[22.49rem]:hidden" />
          <Icon
            name="close"
            size={20}
            className="hidden group-open:block max-[22.49rem]:group-open:hidden"
          />
        </summary>
        <m.nav
          key={openings}
          aria-label={ariaLabel}
          initial={animate ? { y: -16, clipPath: "inset(0 0 100% 0)" } : false}
          animate={{ y: 0, clipPath: "inset(0 0 0% 0)" }}
          transition={{ y: sheetSpring, clipPath: { duration: 0.2, ease: [0.2, 0, 0, 1] } }}
          className={cx(
            "absolute inset-x-0 top-full overflow-y-auto overscroll-contain border-y border-tone-border bg-tone-bg shadow-floating",
            "h-[calc(100dvh-var(--header-h,var(--size-header)))] px-(--gutter) pt-(--space-4) pb-(--space-8)",
          )}
        >
          <div className="md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-x-(--space-8)">
            <ul className="m-0 list-none p-0">
              {items.map((item) => (
                <MobileItem key={item.key} item={item} active={item.key === activeKey} />
              ))}
            </ul>
            {groups.length > 0 ? (
              <div className="hidden min-w-0 md:block">
                {groups.map(({ item, columns }) => (
                  <div key={item.key} className="pb-(--space-5)">
                    <div className="grid grid-cols-2 gap-x-(--space-6) gap-y-(--space-2)">
                      {columns.map((column) => (
                        <GroupColumn key={column.key} column={column} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {utility && utility.length > 0 ? (
            <ul className="m-0 mt-(--space-3) flex list-none flex-wrap gap-x-(--space-5) p-0 md:mt-(--space-5) md:border-t md:border-tone-border md:pt-(--space-3)">
              {utility.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={cx(
                      quietLinkClasses,
                      "flex min-h-11 items-center gap-(--space-2) text-small font-semibold text-tone-link",
                    )}
                  >
                    {link.label}
                    <Icon name="arrow-right" size={16} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {social && social.length > 0 ? (
            <SocialLinks
              links={social}
              className="mt-(--space-5) md:border-t md:border-tone-border md:pt-(--space-4)"
            />
          ) : null}
        </m.nav>
      </details>
    </div>
  );
}

function visibleColumns(item: SiteNavItem): MegaMenuColumn[] {
  return (item.menu?.columns ?? []).filter((column) => column.links.length > 0);
}

const rowLink = "flex min-h-(--size-button-md) items-center py-(--space-2) no-underline";

function MobileItem({ item, active }: { item: SiteNavItem; active: boolean }) {
  const columns = visibleColumns(item);
  const current = active ? ({ "aria-current": "true" } as const) : {};
  const rowClasses = cx(
    "text-body-l text-tone-heading",
    active ? "font-semibold underline decoration-2 underline-offset-4" : "font-medium",
  );

  if (columns.length === 0) {
    return (
      <li className="border-b border-tone-border">
        <a href={item.href} {...current} className={cx(rowClasses, rowLink)}>
          {item.label}
        </a>
      </li>
    );
  }

  return (
    <li className="border-b border-tone-border">
      {/* Tablet: the groups are open in the right-hand column, so the row is the index link. */}
      <a href={item.href} {...current} className={cx(rowClasses, rowLink, "hidden md:flex")}>
        {item.label}
      </a>
      <details className="group/section md:hidden">
        <summary
          className={cx(
            "flex min-h-(--size-button-md) cursor-pointer list-none items-center justify-between gap-(--space-3) py-(--space-2)",
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
              "flex min-h-11 items-center gap-(--space-2) text-body font-semibold",
            )}
          >
            <span>{item.label}</span>
            <Icon name="arrow-right" size={16} />
          </a>
          {columns.map((column) => (
            <GroupColumn
              key={column.key}
              column={column}
              showHeading={item.menu?.layout !== "list"}
            />
          ))}
        </div>
      </details>
    </li>
  );
}

function GroupColumn({
  column,
  showHeading = true,
}: {
  column: MegaMenuColumn;
  /** Off for a `list` menu on phones: the row above already names the section. */
  showHeading?: boolean;
}) {
  return (
    <div className="mt-(--space-3) min-w-0">
      <p className={cx("m-0 text-eyebrow text-tone-muted uppercase", !showHeading && "sr-only")}>
        {column.href ? (
          <a
            href={column.href}
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            {column.heading}
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center">{column.heading}</span>
        )}
      </p>
      <ul className="m-0 list-none p-0">
        {column.links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <a
              href={link.href}
              className={cx(
                quietLinkClasses,
                "flex min-h-11 items-center py-(--space-1) text-body",
              )}
            >
              {link.label}
            </a>
          </li>
        ))}
        {column.more ? (
          <li>
            <a
              href={column.more.href}
              className={cx(
                quietLinkClasses,
                "flex min-h-11 items-center gap-(--space-2) text-small font-semibold text-tone-link",
              )}
            >
              {column.more.label}
              <Icon name="arrow-right" size={16} />
            </a>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
