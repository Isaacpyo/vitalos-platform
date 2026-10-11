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
import { Container } from "../../primitives/Container";
import { Icon } from "../../primitives/Icon";
import { topLevelLinkClasses, quietLinkClasses } from "./nav-styles";
import type { MegaMenuColumn } from "./types";

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
 * - Without JavaScript the panel stays closed and the label link still works.
 */
export function MegaMenu({
  label,
  href,
  columns,
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
      className={cx("flex items-center self-stretch", className)}
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
      <div
        id={panelId}
        hidden={!open}
        role="group"
        aria-label={label}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-h,var(--size-header)))] overflow-y-auto border-b border-tone-border bg-tone-bg shadow-floating"
      >
        <Container size="wide">
          <MotionIsland>
            <m.div
              key={openings}
              initial={motionAllowed && openings > 0 ? "closed" : false}
              animate="open"
              variants={panelVariants}
              className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-x-(--space-6) gap-y-(--space-5) py-(--space-6)"
            >
              {visibleColumns.map((column) => (
                <m.div key={column.key} variants={columnVariants} className="min-w-0">
                  <MenuColumn column={column} panelId={panelId} />
                </m.div>
              ))}
            </m.div>
          </MotionIsland>
        </Container>
      </div>
    </li>
  );
}

function MenuColumn({ column, panelId }: { column: MegaMenuColumn; panelId: string }) {
  const headingId = `${panelId}-${column.key}`;
  return (
    <div className="min-w-0">
      <p id={headingId} className="text-eyebrow text-tone-muted uppercase">
        {column.href ? (
          <a href={column.href} className="underline underline-offset-4 hover:text-tone-heading">
            {column.heading}
          </a>
        ) : (
          column.heading
        )}
      </p>
      <ul aria-labelledby={headingId} className="m-0 mt-(--space-3) list-none p-0">
        {column.links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <a
              href={link.href}
              className={cx(quietLinkClasses, "block py-(--space-2) text-body font-medium")}
            >
              {link.label}
              {link.description ? (
                <span className="mt-(--space-1) block text-small font-normal text-tone-muted">
                  {link.description}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
