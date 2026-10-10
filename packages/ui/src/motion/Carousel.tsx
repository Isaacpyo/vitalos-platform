"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { ReactNode } from "react";
import { cx } from "../primitives/_internal/cx";
import { Icon } from "../primitives/Icon";
import { prefersReducedMotion } from "./_internal/island";

export interface CarouselProps {
  /** Accessible name of the carousel region, for example the section heading. */
  label: string;
  /** Accessible names of the two paging buttons. */
  previousLabel: string;
  nextLabel: string;
  /** The items, each an `<li>`. */
  children: ReactNode;
  className?: string | undefined;
}

interface Paging {
  ready: boolean;
  canPrevious: boolean;
  canNext: boolean;
}

/** Pointer travel (px) before a press becomes a drag; below it, a press is still a click. */
const DRAG_THRESHOLD = 6;

const control =
  "inline-flex size-12 items-center justify-center rounded-full border border-tone-control-border bg-tone-bg text-tone-heading " +
  "transition-colors duration-(--duration-feedback) ease-(--ease-standard) " +
  "enabled:hover:border-tone-action enabled:hover:text-tone-link disabled:cursor-not-allowed disabled:border-tone-border disabled:text-tone-muted";

/** True when the list is laid out as a horizontal row that can actually scroll. */
function isRow(list: HTMLElement): boolean {
  return list.scrollWidth > list.clientWidth + 4;
}

/**
 * Horizontal browsing for a set of peer items (Stage 9 section 17, carousel policy; ADR-024).
 *
 * - Below lg it is a normal stacked list (one column on phones, two on tablets): no horizontal
 *   carousel for content on phones or tablets (Stage 9 sections 17 and 20, Stage 11 section 10).
 * - From lg it is a native scroll-snap row. Every item stays in the DOM and in the tab order;
 *   focusing a link scrolls it into view. Previous/next buttons page by one item and are
 *   disabled at either end. Arrow Left/Right move to the previous/next item and Home/End to the
 *   first/last, paging the row with them. A mouse or pen can drag the row; touch keeps native
 *   scrolling. Snap points settle every gesture on an item edge.
 * - Without JavaScript the row still scrolls natively; the buttons stay disabled.
 * - Paging is instant under reduced motion. Nothing auto-advances.
 */
export function Carousel({ label, previousLabel, nextLabel, children, className }: CarouselProps) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const drag = useRef<{ id: number; x: number; left: number; moved: boolean } | null>(null);
  const [paging, setPaging] = useState<Paging>({
    ready: false,
    canPrevious: false,
    canNext: false,
  });

  const update = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setPaging({
      ready: true,
      canPrevious: list.scrollLeft > 4,
      canNext: list.scrollLeft + list.clientWidth < list.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    update();
    // At most one paging-state update per frame while the row scrolls.
    let frame = 0;
    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    list.addEventListener("scroll", schedule, { passive: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(list);
    return () => {
      list.removeEventListener("scroll", schedule);
      resize?.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [update]);

  const behavior = (): ScrollBehavior => (prefersReducedMotion() ? "auto" : "smooth");

  const items = () => Array.from(listRef.current?.children ?? []) as HTMLElement[];

  /** Scrolls so that item `index` sits at the start edge (its snap position). */
  const scrollToItem = (index: number) => {
    const list = listRef.current;
    const all = items();
    const target = all[Math.max(0, Math.min(index, all.length - 1))];
    const first = all[0];
    if (!list || !target || !first) return;
    list.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: behavior() });
  };

  /** Index of the first item whose start edge is at or after the current scroll position. */
  const firstVisible = () => {
    const list = listRef.current;
    const all = items();
    const first = all[0];
    if (!list || !first) return 0;
    const index = all.findIndex(
      (item) => item.offsetLeft - first.offsetLeft >= list.scrollLeft - 4,
    );
    return index === -1 ? all.length - 1 : index;
  };

  const page = (direction: 1 | -1) => scrollToItem(firstVisible() + direction);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const list = listRef.current;
    if (!list || !isRow(list)) return;
    const all = items();
    const current = all.findIndex((item) => item.contains(document.activeElement));
    if (current === -1) return;
    const next =
      event.key === "ArrowRight"
        ? current + 1
        : event.key === "ArrowLeft"
          ? current - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? all.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    const target = all[Math.max(0, Math.min(next, all.length - 1))];
    const focusable = target?.querySelector<HTMLElement>("a[href], button:not([disabled])");
    focusable?.focus({ preventScroll: true });
    scrollToItem(all.indexOf(target as HTMLElement));
  };

  // Drag to scroll for a mouse or pen (touch already scrolls natively).
  const onPointerDown = (event: PointerEvent<HTMLUListElement>) => {
    const list = listRef.current;
    if (!list || event.pointerType === "touch" || event.button !== 0 || !isRow(list)) return;
    drag.current = { id: event.pointerId, x: event.clientX, left: list.scrollLeft, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLUListElement>) => {
    const list = listRef.current;
    const state = drag.current;
    if (!list || !state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    if (!state.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      state.moved = true;
      list.setPointerCapture(event.pointerId);
      // Free movement while dragging; snapping resumes on release and settles on an item.
      list.style.scrollSnapType = "none";
      list.style.scrollBehavior = "auto";
      list.dataset["dragging"] = "";
    }
    list.scrollLeft = state.left - dx;
  };

  const endDrag = (event: PointerEvent<HTMLUListElement>) => {
    const list = listRef.current;
    const state = drag.current;
    if (!list || !state || state.id !== event.pointerId) return;
    drag.current = null;
    if (!state.moved) return;
    if (list.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
    list.style.scrollSnapType = "";
    list.style.scrollBehavior = "";
    delete list.dataset["dragging"];
    // Land on the nearest item edge, then swallow the click that ends the drag.
    const all = items();
    const first = all[0];
    if (first) {
      let nearest = 0;
      let best = Infinity;
      all.forEach((item, index) => {
        const distance = Math.abs(item.offsetLeft - first.offsetLeft - list.scrollLeft);
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      });
      scrollToItem(nearest);
    }
    const swallow = (click: Event) => {
      click.preventDefault();
      click.stopPropagation();
    };
    list.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => list.removeEventListener("click", swallow, { capture: true }), 0);
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cx("min-w-0", className)}
    >
      <div
        className={cx(
          "mb-(--space-5) hidden justify-end gap-(--space-3) lg:flex",
          // Everything fits: keep the space (no layout shift) but drop the inert controls.
          paging.ready && !paging.canPrevious && !paging.canNext && "lg:invisible",
        )}
      >
        <button
          type="button"
          className={control}
          aria-controls={listId}
          aria-label={previousLabel}
          disabled={!paging.ready || !paging.canPrevious}
          onClick={() => page(-1)}
        >
          <Icon name="arrow-left" size={20} />
        </button>
        <button
          type="button"
          className={control}
          aria-controls={listId}
          aria-label={nextLabel}
          disabled={!paging.ready || !paging.canNext}
          onClick={() => page(1)}
        >
          <Icon name="arrow-right" size={20} />
        </button>
      </div>
      <ul
        id={listId}
        ref={listRef}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={(event) => event.preventDefault()}
        className={cx(
          "m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 md:grid-cols-2",
          "lg:flex lg:snap-x lg:snap-mandatory lg:overflow-x-auto lg:overscroll-x-contain lg:pb-(--space-2)",
          "lg:cursor-grab lg:data-dragging:cursor-grabbing lg:data-dragging:select-none",
          "[&>li]:min-w-0 lg:[&>li]:shrink-0 lg:[&>li]:snap-start",
          "lg:[&>li]:basis-[calc((100%-2*var(--space-5))/3)]",
          "xl:[&>li]:basis-[calc((100%-3*var(--space-5))/4)]",
        )}
      >
        {children}
      </ul>
    </div>
  );
}
