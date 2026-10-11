import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./_internal/cx";
import { VisuallyHidden } from "./VisuallyHidden";

export interface MetaItem {
  /** Name of the datum, for example "Author" or "Published". */
  label: string;
  value: ReactNode;
  /** Keep the label for assistive technology only (a date needs no visible label). */
  hideLabel?: boolean;
}

export interface MetaRowProps extends ComponentPropsWithoutRef<"dl"> {
  items: ReadonlyArray<MetaItem>;
}

/** Author, date, read time, status or maturity as a labelled row. Renders nothing when empty. */
export function MetaRow({ items, className, ...props }: MetaRowProps) {
  if (items.length === 0) return null;
  return (
    <dl
      className={cx(
        "m-0 flex flex-wrap gap-x-(--space-5) gap-y-(--space-1) text-small text-tone-muted",
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        // Label and value flow as one line of text and wrap between words; as two flex items the
        // label was squeezed and broke mid-word on narrow screens ("Engageme / nt" at 320px).
        <div key={item.label} className="min-w-0">
          <dt className={cx("inline", !item.hideLabel && "font-medium")}>
            {item.hideLabel ? <VisuallyHidden>{item.label}</VisuallyHidden> : <>{item.label}:</>}
          </dt>{" "}
          <dd className="m-0 inline text-tone-text">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
