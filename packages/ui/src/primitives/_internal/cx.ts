/** Joins class names, dropping falsy parts. Internal helper, not exported from the package. */
export function cx(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
