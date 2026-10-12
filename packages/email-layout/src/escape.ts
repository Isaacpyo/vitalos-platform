/**
 * Cleaning and escaping shared by every Vitalos email. The Super Admin's Python renderer mirrors
 * these rules exactly (the golden fixtures in `superadmin/email-layout/fixtures` prove it).
 */

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const BIDI = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/** Removes control and bidi-override characters and normalises line endings; keeps line breaks. */
export function cleanMultiline(value: string | undefined): string {
  return (value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(CONTROL, "")
    .replace(BIDI, "")
    .trim();
}

/** As `cleanMultiline`, folded onto one line. */
export function cleanLine(value: string | undefined): string {
  return cleanMultiline(value).replace(/\s*\n\s*/g, " ");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Truncates to `max` code points, adding an ellipsis when something was cut. */
export function truncate(value: string, max: number): string {
  const points = [...value];
  return points.length <= max
    ? value
    : `${points
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`;
}
