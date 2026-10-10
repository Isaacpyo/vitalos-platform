import { DataTable } from "../_internal/DataTable";
import { hasText, type NonEmptyArray } from "../_internal/types";

export interface EvaluationRow {
  /** The evaluation dimension, for example quality, latency, cost, groundedness, escalation. */
  dimension: string;
  /** One value per value column, in order. */
  values: readonly string[];
}

export interface EvaluationTableProps {
  /** Visible title and accessible name of the table. */
  caption: string;
  /** Heading of the first column (the dimension). */
  dimensionHeading: string;
  /** Headings of the value columns (for example target, measured, method). */
  columns: NonEmptyArray<string>;
  /** Renders nothing when empty. */
  rows: readonly EvaluationRow[];
  className?: string | undefined;
}

/**
 * AI evaluation module (Stage 9 section 19). Full table from md; below it each row becomes a
 * labelled key/value stack, so it never forces horizontal scroll.
 */
export function EvaluationTable({
  caption,
  dimensionHeading,
  columns,
  rows,
  className,
}: EvaluationTableProps) {
  const valid = rows.filter((row) => hasText(row.dimension));
  if (valid.length === 0 || !hasText(caption)) return null;
  return (
    <DataTable
      caption={caption}
      columns={[dimensionHeading, ...columns]}
      rows={valid.map((row) => [row.dimension, ...row.values])}
      className={className}
    />
  );
}
