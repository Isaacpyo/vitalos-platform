"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";
import type { Variants } from "motion/react";
import * as m from "motion/react-m";
import { EASE_EMPHASIS, MotionIsland, useMotionAllowed } from "../../motion/_internal/island";
import { cx } from "../../primitives/_internal/cx";
import { Button } from "../../primitives/Button";
import { Icon } from "../../primitives/Icon";
import { IconTile } from "../../primitives/IconTile";
import { topLevelLinkClasses, quietLinkClasses } from "./nav-styles";
import type { MegaMenuColumn, MegaMenuFeature } from "./types";

/** Pointer must dwell this long before the menu opens (hover intent). */
const HOVER_OPEN_DELAY_MS = 120;
/** Grace period for crossing the gap between the trigger and the panel. */
const HOVER_CLOSE_DELAY_MS = 220;

/**
 * Panel reveal within Stage 9's 160 to 240ms menu budget: the panel fades and drops 6px over
 * 160ms while its columns follow 25ms apart, so four columns finish by 235ms. Only on an opening
 * the visitor caused; never on first paint, never under reduced motion.
 */
const panelVariants: Variants = {
  closed: { opacity: 0, y: -6 },
  open: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.16, ease: EASE_EMPHASIS, staggerChildren: 0.025 },
  },
};
const columnVariants: Variants = {
  closed: { opacity: 0, y: -4 },
  open: { opacity: 1, y: 0, transition: { duration: 0.16, ease: EASE_EMPHASIS } },
};

export interface MegaMenuProps {
  /** Top-level label, for example the section name. It is a real link to `href`. */
  label: string;
  /** Section index. Clicking the label always reaches it (no hover-only links). */
  href: string;
  columns: readonly MegaMenuColumn[];
  /** `columns` (default) or `list`: a compact dropdown under the label (see SiteNavMenu). */
  layout?: "columns" | "list" | undefined;
  /** A highlighted card beside the columns, from lg (`columns` layout only). */
  feature?: MegaMenuFeature | undefined;
  /** The current section: `aria-current`, bold and underlined (never colour alone). */
  active?: boolean | undefined;
  /** Accessible name of the disclosure button. Defaults to "<label> menu". */
  toggleLabel?: string | undefined;
  /** Id prefix for `aria-controls`; defaults to a generated id. */
  id?: string | undefined;
  /** Render the panel open on first paint (Storybook, documentation). */
  defaultOpen?: boolean | undefined;
  className?: string | undefined;
}

function hasFinePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: fine)").matches
  );
}

/**
 * Desktop mega-menu item (a client island; render it as a child of a `<ul>`).
 *
 * - The label is a plain link to the section index. A SEPARATE disclosure button next to it
 *   (`aria-expanded`, `aria-controls`) opens the panel, so link and disclosure never compete.
 * - Hover opens the panel only for a fine pointer (`(pointer: fine)`) after a short dwell. Touch
 *   and keyboard use the button. Clicking the button while the panel is hover-open pins it.
 * - Escape closes (also for hover-opened content, WCAG 1.4.13) and returns focus to the button.
 * - The panel is in DOM order straight after the button: Tab moves label, button, panel links.
 * - Opening reveals the panel with a short fade and drop and the columns in a 25ms stagger, all
 *   within 240ms (Stage 9 section 11); instant under reduced motion. Closing is instant.
 * - The `columns` panel is a contained card centred under the bar and sized to its columns (never
 *   wider than the viewport less the gutters); `list` is a dropdown under the label.
 * - Without JavaScript the panel stays closed and the label link still works.
 */
export function MegaMenu({
  label,
  href,
  columns,
  layout = "columns",
  feature,
  active = false,
  toggleLabel,
  id,
  defaultOpen,
  className,
}: MegaMenuProps) {
  const generatedId = useId();
  const panelId = `${id ?? generatedId}-panel`;
  const [open, setOpen] = useState(defaultOpen === true);
  const rootRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHover = useRef(false);
  const motionAllowed = useMotionAllowed();
  // Counts openings since mount: each one remounts the animated panel body so it plays again. It
  // is bumped in the same state update that opens the panel (never in an effect afterwards), so
  // the first open frame already starts from the reveal's initial state: no flash of the panel.
  const [openings, setOpenings] = useState(0);
  const openPanel = useCallback(() => {
    setOpenings((count) => count + 1);
    setOpen(true);
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearTimer();
    openedByHover.current = false;
    setOpen(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const root = rootRef.current;
      const focusInside = root?.contains(document.activeElement) ?? false;
      close();
      if (focusInside) buttonRef.current?.focus();
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  const visibleColumns = columns.filter((column) => column.links.length > 0);
  const list = layout === "list";

  if (visibleColumns.length === 0) {
    return (
      <li className={cx("flex items-center self-stretch", className)}>
        <a
          href={href}
          {...(active ? { "aria-current": "true" as const } : {})}
          className={topLevelLinkClasses(active)}
        >
          {label}
        </a>
      </li>
    );
  }

  const onPointerEnter = (event: PointerEvent<HTMLLIElement>) => {
    if (event.pointerType === "touch" || !hasFinePointer()) return;
    clearTimer();
    if (open) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      openedByHover.current = true;
      openPanel();
    }, HOVER_OPEN_DELAY_MS);
  };

  const onPointerLeave = (event: PointerEvent<HTMLLIElement>) => {
    if (event.pointerType === "touch" || !hasFinePointer()) return;
    clearTimer();
    if (open && openedByHover.current) {
      timer.current = setTimeout(close, HOVER_CLOSE_DELAY_MS);
    }
  };

  const onBlur = (event: FocusEvent<HTMLLIElement>) => {
    const next = event.relatedTarget;
    if (open && next instanceof Node && !event.currentTarget.contains(next)) close();
  };

  const onToggle = () => {
    clearTimer();
    if (open && openedByHover.current) {
      // The pointer opened it; a click pins it open rather than closing what the user just saw.
      openedByHover.current = false;
      return;
    }
    openedByHover.current = false;
    if (open) setOpen(false);
    else openPanel();
  };

  return (
    <li
      ref={rootRef}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onBlur={onBlur}
      className={cx("flex items-center self-stretch", list && "relative", className)}
    >
      <a
        href={href}
        {...(active ? { "aria-current": "true" as const } : {})}
        className={cx(topLevelLinkClasses(active), "pr-(--space-1)")}
      >
        {label}
      </a>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={toggleLabel ?? `${label} menu`}
        onClick={onToggle}
        className="group ml-2 inline-flex min-h-(--size-button-md) min-w-(--size-button-sm) items-center justify-center text-tone-heading"
      >
        <Icon
          name="chevron-down"
          size={16}
          className="transition-transform duration-(--duration-feedback) ease-(--ease-standard) group-aria-expanded:rotate-180"
        />
      </button>
      {list ? (
        <div
          id={panelId}
          hidden={!open}
          role="group"
          aria-label={label}
          className="absolute top-full left-0 w-max max-w-xs min-w-60 border border-tone-border bg-tone-bg shadow-floating"
        >
          <MotionIsland>
            <m.ul
              key={openings}
              initial={motionAllowed && openings > 0 ? "closed" : false}
              animate="open"
              variants={panelVariants}
              className="m-0 list-none p-(--space-2)"
            >
              {visibleColumns
                .flatMap((column) => column.links)
                .map((link) => (
                  <m.li key={`${link.href}-${link.label}`} variants={columnVariants}>
                    <a
                      href={link.href}
                      className={cx(
                        quietLinkClasses,
                        "flex min-h-11 items-center px-(--space-3) text-small font-medium",
                      )}
                    >
                      {link.label}
                    </a>
                  </m.li>
                ))}
            </m.ul>
          </MotionIsland>
        </div>
      ) : (
        <div
          id={panelId}
          hidden={!open}
          role="group"
          aria-label={label}
          className="absolute top-[calc(100%+var(--space-2))] left-1/2 max-h-[calc(100dvh-var(--header-h,var(--size-header))-var(--space-4))] w-max max-w-[calc(100vw-2*var(--gutter))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-tone-border bg-tone-bg shadow-floating"
        >
          <MotionIsland>
            <m.div
              key={openings}
              initial={motionAllowed && openings > 0 ? "closed" : false}
              animate="open"
              variants={panelVariants}
              className={cx(
                "grid gap-x-(--space-7) gap-y-(--space-5) p-(--space-6)",
                feature && "lg:grid-cols-[auto_minmax(15rem,18rem)]",
              )}
            >
              <div
                className="grid gap-x-(--space-6) gap-y-(--space-5)"
                style={{
                  gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(10rem, 14rem))`,
                }}
              >
                {visibleColumns.map((column) => (
                  <m.div key={column.key} variants={columnVariants} className="min-w-0">
                    <MenuColumn column={column} panelId={panelId} />
                  </m.div>
                ))}
              </div>
              {feature ? (
                <m.div variants={columnVariants} className="hidden min-w-0 lg:block">
                  <MenuFeature feature={feature} />
                </m.div>
              ) : null}
            </m.div>
          </MotionIsland>
        </div>
      )}
    </li>
  );
}

function MenuColumn({ column, panelId }: { column: MegaMenuColumn; panelId: string }) {
  const headingId = `${panelId}-${column.key}`;
  const rich = column.links.some((link) => link.icon || link.description);
  return (
    <div className="flex h-full min-w-0 flex-col">
      <p id={headingId} className="text-eyebrow text-tone-muted uppercase">
        {column.href ? (
          <a href={column.href} className="underline underline-offset-4 hover:text-tone-heading">
            {column.heading}
          </a>
        ) : (
          column.heading
        )}
      </p>
      <ul
        aria-labelledby={headingId}
        className={cx("m-0 mt-(--space-3) list-none p-0", rich && "-mx-(--space-2)")}
      >
        {column.links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            {rich ? (
              <a
                href={link.href}
                className="group flex items-start gap-(--space-3) rounded-lg p-(--space-2) no-underline transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:bg-tone-tile-bg/50"
              >
                {link.icon ? <IconTile name={link.icon} size="sm" /> : null}
                <span className="min-w-0">
                  <span className="block text-small font-medium text-tone-heading group-hover:text-tone-link">
                    {link.label}
                  </span>
                  {link.description ? (
                    <span className="mt-(--space-1) line-clamp-2 block text-small text-tone-muted">
                      {link.description}
                    </span>
                  ) : null}
                </span>
              </a>
            ) : (
              <a
                href={link.href}
                className={cx(quietLinkClasses, "block py-(--space-2) text-small font-medium")}
              >
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
      {column.more ? (
        <a
          href={column.more.href}
          className="group mt-auto inline-flex items-center gap-(--space-2) pt-(--space-3) text-small font-semibold text-tone-link no-underline hover:underline"
        >
          {column.more.label}
          <Icon
            name="arrow-right"
            size={16}
            className="transition-transform duration-(--duration-feedback) ease-(--ease-standard) group-hover:translate-x-0.5"
          />
        </a>
      ) : null}
    </div>
  );
}

/**
 * The panel's highlighted card on the dark tone: an eyebrow, a title, optional text, optional
 * ticked steps and its actions. Presentation only; every string comes from props.
 */
function MenuFeature({ feature }: { feature: MegaMenuFeature }) {
  const [primary, ...others] = feature.links;
  const steps = feature.steps ?? [];
  return (
    <div
      data-tone="dark"
      className="relative isolate flex h-full flex-col overflow-hidden rounded-xl bg-tone-bg p-(--space-6) text-tone-text"
    >
      <span
        aria-hidden="true"
        className="absolute -top-16 -right-16 -z-10 size-48 rounded-full bg-blue-600/30 blur-3xl"
      />
      {feature.eyebrow ? (
        <p className="m-0 text-eyebrow text-tone-eyebrow uppercase">{feature.eyebrow}</p>
      ) : null}
      <p className="m-0 mt-(--space-3) text-body font-semibold text-balance text-tone-heading">
        {feature.title}
      </p>
      {feature.text ? (
        <p className="m-0 mt-(--space-3) text-small text-tone-muted">{feature.text}</p>
      ) : null}
      {steps.length > 0 ? (
        <ol className="relative m-0 mt-(--space-5) flex list-none flex-col gap-(--space-3) p-0">
          <span
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[0.5625rem] w-px bg-linear-to-b from-aqua-600 to-blue-600"
          />
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            return (
              <li
                key={`${step}-${index}`}
                className="relative flex items-center gap-(--space-3) text-small text-tone-heading"
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "inline-flex size-[1.125rem] shrink-0 items-center justify-center rounded-full text-white",
                    last ? "bg-blue-600 ring-2 ring-white/70" : "bg-aqua-600",
                  )}
                >
                  <Icon name="check" size={16} className="size-3" />
                </span>
                <span className={last ? "font-semibold" : undefined}>{step}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {primary || others.length > 0 ? (
        <div className="mt-auto flex flex-wrap items-center gap-x-(--space-5) gap-y-(--space-3) pt-(--space-6)">
          {primary ? (
            <Button href={primary.href} size="sm" arrow>
              {primary.label}
            </Button>
          ) : null}
          {others.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-small font-semibold text-tone-heading underline underline-offset-4 hover:text-tone-link"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
