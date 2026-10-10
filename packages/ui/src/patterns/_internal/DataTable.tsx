import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import type { NonEmptyArray } from "./types";

export interface DataTableProps {
  /** Accessible name and visible title of the table. */
  caption: string;
  /** Column headings. The first column identifies the row. */
  columns: NonEmptyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<ReactNode>>;
  className?: string | undefined;
}

/**
 * Responsive table (Stage 9 section 29): a full table from the md breakpoint, a key/value stack
 * below it so it never forces horizontal scroll. Each cell carries its column heading as
 * `data-label`, shown by CSS in the stacked layout. Internal building block for EvaluationTable
 * and SubprocessorTable.
 */
export function DataTable({ caption, columns, rows, className }: DataTableProps) {
  return (
    <table className={cx("block w-full border-collapse text-left md:table", className)}>
      <caption className="mb-(--space-3) block text-left text-body font-semibold text-tone-heading">
        {caption}
      </caption>
      <thead className="sr-only md:not-sr-only md:table-header-group">
        <tr className="md:table-row">
          {columns.map((column, index) => (
            <th
              key={`${column}-${index}`}
              scope="col"
              className="border-b border-tone-heading px-(--space-3) py-(--space-3) text-small font-semibold text-tone-heading first:pl-0"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {rows.map((cells, rowIndex) => (
          <tr
            key={rowIndex}
            className="block border-b border-tone-border py-(--space-3) md:table-row md:py-0"
          >
            {columns.map((column, columnIndex) => {
              const content = cells[columnIndex] ?? null;
              const first = columnIndex === 0;
              const Cell = first ? "th" : "td";
              return (
                <Cell
                  key={`${column}-${columnIndex}`}
                  {...(first ? { scope: "row" as const } : {})}
                  data-label={column}
                  className={cx(
                    "block px-0 py-(--space-1) align-top text-body md:table-cell md:px-(--space-3) md:py-(--space-4) md:first:pl-0",
                    first ? "font-semibold text-tone-heading" : "text-tone-text",
                    !first &&
                      "before:block before:text-small before:font-medium before:text-tone-muted before:content-[attr(data-label)] md:before:hidden",
                  )}
                >
                  {content}
                </Cell>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
