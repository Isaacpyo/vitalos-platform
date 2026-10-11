import type { ReactNode } from "react";
import { Heading } from "../../primitives/Heading";
import type { HeadingSize } from "../../primitives/Heading";
import { cx } from "../../primitives/_internal/cx";
import type { ItemHeadingLevel } from "./types";

/**
 * Heading whose text is the item's link. The anchor's ::after stretches over the nearest
 * `relative` ancestor so the whole card is one target with one accessible name (the title), while
 * the DOM keeps a single link per item.
 */
export function CardTitle({
  level,
  size = "h3",
  href,
  children,
  className,
}: {
  level: ItemHeadingLevel;
  size?: HeadingSize;
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Heading level={level} size={size} className={cx("min-w-0", className)}>
      <a
        href={href}
        className="text-tone-heading no-underline after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4"
      >
        {children}
      </a>
    </Heading>
  );
}
