"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "../primitives/_internal/cx";
import { Icon } from "../primitives/Icon";

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

const control =
  "inline-flex size-12 items-center justify-center rounded-full border border-tone-control-border bg-tone-bg text-tone-heading " +
  "transition-colors duration-(--duration-feedback) ease-(--ease-standard) " +
  "enabled:hover:border-tone-action enabled:hover:text-tone-link disabled:cursor-not-allowed disabled:border-tone-border disabled:text-tone-muted";

/**
 * Horizontal browsing for a set of peer items (Stage 9 section 17, carousel policy).
 *
 * - Below md it is a normal vertical list: no horizontal carousel for content on phones.
 * - From md it is a native scroll-snap row. Every item stays in the DOM and in the tab order;
 *   focusing a link scrolls it into view. Previous/next buttons page by one item and are
 *   disabled at either end.
 * - Without JavaScript the row still scrolls natively; the buttons stay disabled.
 * - Paging is instant under reduced motion. Nothing auto-advances.
 */
export function Carousel({ label, previousLabel, nextLabel, children, className }: CarouselProps) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
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
    list.addEventListener("scroll", update, { passive: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    resize?.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      resize?.disconnect();
    };
  }, [update]);

  const page = (direction: 1 | -1) => {
    const list = listRef.current;
    if (!list) return;
    const first = list.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(list).columnGap || "0") || 0;
    const step = first ? first.getBoundingClientRect().width + gap : list.clientWidth * 0.8;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollBy({ left: direction * step, behavior: reduce ? "auto" : "smooth" });
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
          "mb-(--space-5) hidden justify-end gap-(--space-3) md:flex",
          // Everything fits: keep the space (no layout shift) but drop the inert controls.
          paging.ready && !paging.canPrevious && !paging.canNext && "md:invisible",
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
        className={cx(
          "m-0 grid list-none grid-cols-1 gap-(--space-5) p-0",
          "md:flex md:snap-x md:snap-mandatory md:overflow-x-auto md:overscroll-x-contain md:pb-(--space-2)",
          "[&>li]:min-w-0 md:[&>li]:shrink-0 md:[&>li]:snap-start",
          "md:[&>li]:basis-[calc((100%-var(--space-5))/2)]",
          "lg:[&>li]:basis-[calc((100%-2*var(--space-5))/3)]",
          "xl:[&>li]:basis-[calc((100%-3*var(--space-5))/4)]",
        )}
      >
        {children}
      </ul>
    </div>
  );
}
