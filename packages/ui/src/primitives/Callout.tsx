import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./_internal/cx";

export interface CalloutProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Short label, for example the decision, definition or proof being called out. */
  title?: ReactNode;
  children: ReactNode;
}

/** An important decision, definition or piece of proof, set apart by a rule (not a card). */
export function Callout({ title, children, className, ...props }: CalloutProps) {
  return (
    <div
      role="note"
      className={cx(
        "border-l-4 border-tone-accent bg-tone-bg py-(--space-2) pl-(--space-5)",
        className,
      )}
      {...props}
    >
      {title ? <p className="text-body font-semibold text-tone-heading">{title}</p> : null}
      <div className={cx("text-body text-tone-text", Boolean(title) && "mt-(--space-2)")}>
        {children}
      </div>
    </div>
  );
}
