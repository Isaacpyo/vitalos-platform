import { cx } from "../../primitives/_internal/cx";

/** Matches LabMaturity (Stage 0 / Stage 8 enum). */
export type MaturityKey =
  "research" | "concept" | "prototype" | "accelerator" | "beta" | "production-product";

export interface MaturityBadgeProps {
  maturity: MaturityKey;
  /**
   * The maturity as text, for example the locked label from the CMS package. REQUIRED: maturity is
   * always stated in words. The outline style also varies by stage (dashed to filled), so no state
   * depends on colour alone, and the badge never implies readiness beyond the stated stage.
   */
  label: string;
  className?: string | undefined;
}

const styles: Record<MaturityKey, string> = {
  research: "border border-dashed border-tone-muted text-tone-text",
  concept: "border border-dashed border-tone-heading text-tone-heading",
  prototype: "border-2 border-dotted border-tone-heading text-tone-heading",
  accelerator: "border border-solid border-tone-heading text-tone-heading",
  beta: "border-2 border-solid border-tone-heading text-tone-heading",
  "production-product": "border border-solid border-tone-heading bg-tone-heading text-tone-bg",
};

/** Lab maturity as a text badge. */
export function MaturityBadge({ maturity, label, className }: MaturityBadgeProps) {
  if (label.trim() === "") return null;
  return (
    <span
      data-maturity={maturity}
      className={cx(
        "inline-flex items-center rounded-sm px-(--space-2) py-0.5 text-small font-semibold",
        styles[maturity],
        className,
      )}
    >
      {label}
    </span>
  );
}
