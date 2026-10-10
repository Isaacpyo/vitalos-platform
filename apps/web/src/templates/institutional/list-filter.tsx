"use client";

import { useState, useSyncExternalStore } from "react";
import { Field, Select } from "@vitalos/ui";
import { rowMatches } from "./list-filter-model";
import type { FilterGroup } from "./list-filter-model";

export interface ListFilterProps {
  /** Id of the server-rendered list whose direct children are the filterable rows. */
  listId: string;
  groups: readonly FilterGroup[];
  /** Number of rows in the list. */
  total: number;
  /** Accessible name of the control group. */
  groupLabel?: string;
  /** Structural labels; callers may override. */
  labels?: { all?: string; showing?: string; of?: string };
}

const subscribeNever = () => () => undefined;

function readRow(row: Element, groups: readonly FilterGroup[]): Record<string, string[]> {
  return Object.fromEntries(
    groups.map((group) => [
      group.key,
      (row.getAttribute(`data-filter-${group.key}`) ?? "").split(" ").filter(Boolean),
    ]),
  );
}

/**
 * Progressive enhancement over a crawlable list: after hydration it shows one select per filter
 * group and hides rows that do not match by toggling `hidden` on them. The list itself is
 * server-rendered in full, the URL never changes and nothing is rendered without JavaScript.
 */
export function ListFilter({
  listId,
  groups,
  total,
  groupLabel = "Filter",
  labels,
}: Readonly<ListFilterProps>) {
  // False on the server and during hydration, true afterwards: the controls only exist with JS.
  const ready = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [shown, setShown] = useState(total);

  if (!ready || groups.length === 0) return null;

  const apply = (next: Record<string, string>) => {
    const list = document.getElementById(listId);
    if (!list) return;
    let visible = 0;
    for (const row of Array.from(list.children)) {
      const match = rowMatches(readRow(row, groups), next);
      (row as HTMLElement).hidden = !match;
      if (match) visible += 1;
    }
    setSelection(next);
    setShown(visible);
  };

  return (
    <div role="group" aria-label={groupLabel} className="min-w-0">
      <div className="grid grid-cols-1 gap-(--space-4) sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Field key={group.key} label={group.label}>
            <Select
              value={selection[group.key] ?? ""}
              onChange={(event) => apply({ ...selection, [group.key]: event.target.value })}
            >
              <option value="">{labels?.all ?? "All"}</option>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>
      <p role="status" className="m-0 mt-(--space-3) text-small text-tone-muted">
        {labels?.showing ?? "Showing"} {shown} {labels?.of ?? "of"} {total}
      </p>
    </div>
  );
}
