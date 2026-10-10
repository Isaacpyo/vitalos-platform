/**
 * Accepts only same-site relative paths. Rejects protocol-relative URLs, backslashes and ASCII
 * control characters: browsers strip tabs and newlines inside URLs, so a path such as
 * "/<TAB>/evil.invalid" would otherwise become "//evil.invalid".
 */
// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001f\u007f]/;

export const isSafeRelativeRedirect = (value: string) =>
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  !controlCharacters.test(value);
