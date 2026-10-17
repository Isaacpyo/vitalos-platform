"use client";

import { useEffect, useState } from "react";

/**
 * The FAQ's group titles, stacked in one sticky panel (lg and up). The title of the group in view is
 * marked: a distinct text colour and background, with `aria-current`. Links are plain in-page
 * anchors, so the list works without JavaScript; the script only moves the marker. The colour
 * transition is dropped under `prefers-reduced-motion`.
 */
export function FaqNav({
  items,
  label,
}: Readonly<{ items: readonly { id: string; title: string }[]; label: string }>) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    // A group is current once its top passes a line a third of the way down the viewport.
    const update = () => {
      const line = window.innerHeight / 3;
      let current = sections[0]?.id ?? "";
      for (const section of sections) {
        // Groups the FAQ filter has hidden have no box; they never become current.
        if (!section.hidden && section.getBoundingClientRect().top <= line) current = section.id;
      }
      setActive(current);
    };
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  return (
    <nav aria-label={label}>
      <ul className="m-0 grid list-none gap-(--space-2) p-0">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                {...(current ? { "aria-current": "location" as const } : {})}
                className={`block rounded-md px-(--space-4) py-(--space-3) text-body font-semibold no-underline transition-colors duration-(--duration-feedback) ease-(--ease-standard) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus motion-reduce:transition-none ${
                  current
                    ? "bg-tone-tile-bg text-tone-tile-fg"
                    : "bg-transparent text-tone-muted hover:text-tone-heading"
                }`}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
