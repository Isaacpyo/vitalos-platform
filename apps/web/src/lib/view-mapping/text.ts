/** The first sentence of a text (up to and including its first ". "), or the whole text. */
export function firstSentence(text: string | undefined): string | undefined {
  const value = text?.trim();
  if (!value) return undefined;
  const end = value.indexOf(". ");
  return end === -1 ? value : value.slice(0, end + 1);
}
