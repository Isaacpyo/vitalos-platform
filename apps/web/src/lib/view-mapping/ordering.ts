/**
 * Orders items by a locked list of names (for example the five practice pages in the order the specs
 * give them). The content sources sort by title, which is alphabetical, so the order the specs
 * fix is applied here.
 *
 * An item matches a locked name when its title equals the name, or equals `Vitalos <name>`, ignoring
 * case and surrounding space. Items that match nothing keep their relative order after the matched
 * ones, so unknown content is never dropped.
 */
export function orderByLockedNames<T extends { title: string }>(
  items: readonly T[],
  names: readonly string[],
  brandPrefix = "Vitalos",
): T[] {
  const normalise = (value: string) => value.trim().toLowerCase();
  const rankOf = (title: string): number => {
    const t = normalise(title);
    return names.findIndex((name) => {
      const n = normalise(name);
      return t === n || t === normalise(`${brandPrefix} ${name}`);
    });
  };
  const keyed = items.map((item, position) => ({ item, position, rank: rankOf(item.title) }));
  keyed.sort((a, b) => {
    const ra = a.rank === -1 ? Number.POSITIVE_INFINITY : a.rank;
    const rb = b.rank === -1 ? Number.POSITIVE_INFINITY : b.rank;
    return ra === rb ? a.position - b.position : ra - rb;
  });
  return keyed.map((entry) => entry.item);
}

/** Only the items whose title matches one of the locked names, in locked order. */
export function pickByLockedNames<T extends { title: string }>(
  items: readonly T[],
  names: readonly string[],
  brandPrefix = "Vitalos",
): T[] {
  const normalise = (value: string) => value.trim().toLowerCase();
  const wanted = new Set(names.flatMap((n) => [normalise(n), normalise(`${brandPrefix} ${n}`)]));
  return orderByLockedNames(items, names, brandPrefix).filter((item) =>
    wanted.has(normalise(item.title)),
  );
}
