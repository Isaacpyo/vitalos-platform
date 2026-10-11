/**
 * Pure model of the client-side list filter. The filtered list is always rendered in full on the
 * server (crawlable, works without JavaScript); the filter only hides rows after hydration, and
 * never changes the URL, so there are no indexable filter permutations (Stage 9 §24).
 */

export interface FilterOption {
  /** Space-free token carried on rows (a slug). */
  value: string;
  label: string;
}

export interface FilterGroup {
  /** Attribute-safe key, for example `practice`. Rows carry `data-filter-<key>`. */
  key: string;
  /** Visible label of the control. */
  label: string;
  options: FilterOption[];
}

export interface FilterDimension<Item> {
  key: string;
  label: string;
  /** Options an item belongs to in this dimension. */
  valuesOf: (item: Item) => readonly FilterOption[];
}

/**
 * Filter groups for a set of items. A dimension becomes a control only when it can actually
 * partition the list: two or more distinct options, or one option that some items lack.
 */
export function buildFilterGroups<Item>(
  items: readonly Item[],
  dimensions: readonly FilterDimension<Item>[],
): FilterGroup[] {
  const groups: FilterGroup[] = [];
  for (const dimension of dimensions) {
    const options = new Map<string, string>();
    let someLack = false;
    for (const item of items) {
      const values = dimension.valuesOf(item).filter((o) => o.value !== "" && !/\s/.test(o.value));
      if (values.length === 0) someLack = true;
      for (const option of values)
        if (!options.has(option.value)) options.set(option.value, option.label);
    }
    if (options.size === 0) continue;
    if (options.size < 2 && !someLack) continue;
    groups.push({
      key: dimension.key,
      label: dimension.label,
      options: [...options]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "en-GB")),
    });
  }
  return groups;
}

/** Data attributes for one row: `data-filter-<key>="token token"` for every group it has values in. */
export function rowFilterAttributes<Item>(
  item: Item,
  dimensions: readonly FilterDimension<Item>[],
  groups: readonly FilterGroup[],
): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const group of groups) {
    const dimension = dimensions.find((d) => d.key === group.key);
    if (!dimension) continue;
    const allowed = new Set(group.options.map((o) => o.value));
    const tokens = dimension
      .valuesOf(item)
      .map((o) => o.value)
      .filter((value) => allowed.has(value));
    if (tokens.length > 0) attributes[`data-filter-${group.key}`] = tokens.join(" ");
  }
  return attributes;
}

/** Whether a row with `rowValues` (per group key) satisfies the selection (group key to token). */
export function rowMatches(
  rowValues: Readonly<Record<string, readonly string[]>>,
  selection: Readonly<Record<string, string>>,
): boolean {
  return Object.entries(selection).every(
    ([key, token]) => token === "" || (rowValues[key] ?? []).includes(token),
  );
}
