import { repoSettingsFacts } from "@vitalos/cms/repo";
import { palette } from "@vitalos/design-tokens";
import type { EnquiryIntent, EnquiryTimeframe } from "@vitalos/validation/enquiry";
import type { NotificationMessage } from "../domain/ports";
import { inlineImages } from "./email-inline-images";
import type { InlineImage } from "./email-inline-images";

/**
 * The internal "new enquiry" notification email: subject, plain-text part and HTML part. The
 * notifier sends the two parts as multipart/alternative. Pure functions, no I/O.
 *
 * Rendering rules:
 * - Every field of the enquiry is shown. An empty field reads "Not provided"; the row stays.
 *   Role, budget range and offer are shown only when present, as before (the form rarely sets them).
 * - Every user-supplied value is cleaned (control and bidirectional-override characters removed)
 *   and, in HTML, escaped. Single-line fields are folded onto one line, so they cannot fake extra
 *   fields or headers. The goal keeps its line breaks; in the plain-text part every goal line is
 *   quoted with "> " so it cannot pass for a field.
 * - HTML is table-based with inline styles, a single 600px column, system fonts, no scripts and
 *   no remote assets. The logo and social icons are inline CID attachments
 *   (`email-inline-images.ts`), never fetched. Colours come from the locked design tokens; dark
 *   mode uses `prefers-color-scheme` (Apple Mail, iOS Mail) and Outlook.com's
 *   `data-ogsc`/`data-ogsb` attributes. The light theme also reads correctly when Gmail inverts it.
 * - The links are a `mailto:` to the enquirer, the public source page and the social profiles.
 */

export const FOOTER_NOTE =
  "Internal notification. The enquiry is stored in the Vitalos database; this email is not the record.";

/** Social profiles supplied by the owner on 2026-10-12. Each has an inline icon. */
export const socialLinks = [
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/vitalos",
    image: inlineImages.linkedin,
  },
  { label: "X", url: "https://x.com/vitalos", image: inlineImages.x },
  { label: "Instagram", url: "https://www.instagram.com/vitalos", image: inlineImages.instagram },
  { label: "Facebook", url: "https://www.facebook.com/vitalos", image: inlineImages.facebook },
] as const;

/** Company details for the footer, from the owner-published settings (Companies House record). */
const COMPANY_LINE = `${repoSettingsFacts.legalName}, company number ${repoSettingsFacts.companyNumber}`;
const ADDRESS_LINE = `Registered office: ${repoSettingsFacts.registeredAddress}`;

/** Origin used to show the source page as a full link. The apex redirects to www. */
export const PUBLIC_SITE_ORIGIN = "https://vitalos.co.uk";

const NOT_PROVIDED = "Not provided";

/** Short labels for the email. Unknown values fall back to the raw value. */
export const intentLabels: Record<EnquiryIntent, string> = {
  project: "New project",
  offer: "Offer enquiry",
  engineering: "Engineering support",
  ai: "AI",
  "managed-services": "Managed services",
  procurement: "Procurement",
  partnership: "Partnership",
  careers: "Careers",
  general: "General enquiry",
};

/** Same wording as the form (`components/contact/labels.ts`); the bands are still provisional. */
export const timeframeLabels: Record<EnquiryTimeframe, string> = {
  immediately: "As soon as possible",
  "within-3-months": "Within 3 months",
  "within-6-months": "Within 6 months",
  exploring: "Still exploring",
};

/** A plain address that is safe to use as Reply-To and in a `mailto:` link. */
export const SIMPLE_ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

const PERSONAL_DOMAINS = new Set([
  "aol.com",
  "btinternet.com",
  "gmx.com",
  "gmx.co.uk",
  "icloud.com",
  "mac.com",
  "mail.com",
  "me.com",
  "msn.com",
  "pm.me",
  "proton.me",
  "protonmail.com",
  "sky.com",
  "talktalk.net",
  "virginmedia.com",
  "yandex.com",
  "zoho.com",
]);
/** Free providers that use many country domains: gmail.com, hotmail.co.uk, yahoo.fr and so on. */
const PERSONAL_DOMAIN_FAMILY =
  /^(?:gmail|googlemail|hotmail|outlook|live|yahoo|ymail|rocketmail|aol)\.[a-z]{2,3}(?:\.[a-z]{2})?$/;

export function isPersonalEmailDomain(address: string): boolean {
  const domain = address.slice(address.lastIndexOf("@") + 1).toLowerCase();
  return PERSONAL_DOMAINS.has(domain) || PERSONAL_DOMAIN_FAMILY.test(domain);
}

// ---------------------------------------------------------------------------------------------
// Cleaning and escaping

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const BIDI = /[؜‎‏‪-‮⁦-⁩]/g;

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
function truncate(value: string, max: number): string {
  const points = [...value];
  return points.length <= max
    ? value
    : `${points
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`;
}

const labelFor = <K extends string>(labels: Record<K, string>, raw: string): string =>
  Object.hasOwn(labels, raw) ? labels[raw as K] : raw;

// ---------------------------------------------------------------------------------------------
// Derived values

const ukTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

/** "Mon 12 Oct 2026, 12:09 BST" (GMT in winter), or undefined when the timestamp is unreadable. */
export function formatUkTime(iso: string): string | undefined {
  // PostgreSQL gives microseconds; keep milliseconds so every engine parses the value.
  const date = new Date(iso.replace(/(\.\d{3})\d+/, "$1"));
  if (Number.isNaN(date.getTime())) return undefined;
  const part = Object.fromEntries(ukTimeFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${part.weekday} ${part.day} ${part.month} ${part.year}, ${part.hour}:${part.minute} ${part.timeZoneName}`;
}

const SITE_PATH = /^\/(?!\/)[^\\?#]*$/;

/** Full public URL for a bare site path, or undefined when the value is not one. */
export function sourcePageUrl(path: string): string | undefined {
  if (!SITE_PATH.test(path)) return undefined;
  // Percent-encode everything outside RFC 3986 path characters (existing escapes are kept).
  return (
    PUBLIC_SITE_ORIGIN +
    path.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@/%]/gu, (ch) => encodeURIComponent(ch))
  );
}

export function replySubject(reference: string): string {
  return `Re: Your Vitalos enquiry (${reference})`;
}

function mailtoHref(address: string, subject?: string): string {
  const at = address.lastIndexOf("@");
  const target = `${encodeURIComponent(address.slice(0, at))}@${address.slice(at + 1)}`;
  return `mailto:${target}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}

interface EnquiryView {
  reference: string;
  receivedRaw: string;
  receivedUk: string | undefined;
  name: string;
  firstName: string;
  organisation: string;
  workEmail: string;
  /** True when the address can be replied to (Reply-To and `mailto:`). */
  replyable: boolean;
  personalDomain: boolean;
  role: string;
  intentRaw: string;
  intentLabel: string;
  timeframeRaw: string;
  timeframeLabel: string;
  budgetRange: string;
  offer: string;
  sourcePath: string;
  sourceUrl: string | undefined;
  goal: string;
}

function toView(message: NotificationMessage): EnquiryView {
  const e = message.enquiry;
  const name = cleanLine(e.name);
  const workEmail = cleanLine(e.workEmail);
  const intentRaw = cleanLine(e.intent);
  const timeframeRaw = cleanLine(e.timeframe);
  const sourcePath = cleanLine(e.sourcePath);
  const receivedRaw = cleanLine(e.receivedAt);
  const replyable = SIMPLE_ADDRESS.test(workEmail);
  return {
    reference: cleanLine(e.reference),
    receivedRaw,
    receivedUk: receivedRaw ? formatUkTime(receivedRaw) : undefined,
    name,
    firstName: truncate(name.split(" ")[0] ?? "", 24),
    organisation: cleanLine(e.organisation),
    workEmail,
    replyable,
    personalDomain: replyable && isPersonalEmailDomain(workEmail),
    role: cleanLine(e.role),
    intentRaw,
    intentLabel: intentRaw ? labelFor(intentLabels, intentRaw) : "",
    timeframeRaw,
    timeframeLabel: timeframeRaw ? labelFor(timeframeLabels, timeframeRaw) : "",
    budgetRange: cleanLine(e.budgetRange),
    offer: cleanLine(e.offerSlug),
    sourcePath,
    sourceUrl: sourcePath ? sourcePageUrl(sourcePath) : undefined,
    goal: cleanMultiline(e.goal),
  };
}

// ---------------------------------------------------------------------------------------------
// Subject and preheader

/** "New enquiry: New project · Temitope Agbola, Rttg · VIT-0F867CE48552". Always one line. */
export function buildSubject(message: NotificationMessage): string {
  const v = toView(message);
  const intent = v.intentLabel ? truncate(v.intentLabel, 40) : "Intent not provided";
  const who = [truncate(v.name, 60) || "Name not provided", truncate(v.organisation, 60)]
    .filter(Boolean)
    .join(", ");
  return `New enquiry: ${intent} · ${who} · ${v.reference}`;
}

/** Inbox preview text: "Within 3 months · {first 80 characters of the goal}". */
export function buildPreheader(message: NotificationMessage): string {
  const v = toView(message);
  const goal = cleanLine(v.goal);
  return `${v.timeframeLabel || "Timeframe not provided"} · ${goal ? truncate(goal, 80) : "Goal not provided"}`;
}

// ---------------------------------------------------------------------------------------------
// Plain-text part

/** Same sections, fields and order as the HTML part. */
export function buildTextBody(message: NotificationMessage): string {
  const v = toView(message);
  const or = (value: string) => value || NOT_PROVIDED;
  const labelled = (label: string, raw: string) =>
    !raw ? NOT_PROVIDED : label === raw ? raw : `${label} (${raw})`;
  const reply = v.replyable
    ? `Reply to ${v.firstName || "the enquirer"}: ${mailtoHref(v.workEmail, replySubject(v.reference))}`
    : "Reply: no valid reply address was provided.";

  const lines: (string | undefined)[] = [
    "VITALOS · NEW ENQUIRY",
    "",
    v.organisation
      ? `${or(v.name)}, ${v.organisation}`
      : `${or(v.name)} (organisation not provided)`,
    `${v.intentLabel || "Intent not provided"} · ${v.timeframeLabel || "Timeframe not provided"}`,
    "",
    reply,
    "",
    "GOAL",
    ...(v.goal
      ? v.goal.split("\n").map((line) => (line ? `> ${line}` : ">"))
      : [`> ${NOT_PROVIDED}`]),
    "",
    "CONTACT DETAILS",
    `Name: ${or(v.name)}`,
    `Organisation: ${or(v.organisation)}`,
    `Work email: ${or(v.workEmail)}${v.personalDomain ? " [Personal email domain]" : ""}`,
    v.role ? `Role: ${v.role}` : undefined,
    "",
    "ENQUIRY DETAILS",
    `Intent: ${labelled(v.intentLabel, v.intentRaw)}`,
    `Timeframe: ${labelled(v.timeframeLabel, v.timeframeRaw)}`,
    v.budgetRange ? `Budget range: ${v.budgetRange}` : undefined,
    v.offer ? `Offer: ${v.offer}` : undefined,
    `Source page: ${v.sourceUrl ?? or(v.sourcePath)}`,
    "",
    "META",
    `Reference: ${or(v.reference)}`,
    `Received: ${v.receivedUk ?? or(v.receivedRaw)}`,
    `Received (raw): ${or(v.receivedRaw)}`,
    "",
    "--",
    FOOTER_NOTE,
    "",
    ...socialLinks.map((s) => `${s.label}: ${s.url}`),
    "",
    COMPANY_LINE,
    ADDRESS_LINE,
  ];
  return lines.filter((line) => line !== undefined).join("\n");
}

// ---------------------------------------------------------------------------------------------
// HTML part

/** Colour roles per theme. Text/background pairs are checked for WCAG AA in the tests. */
export const emailTheme = {
  light: {
    page: palette.cloud50,
    surface: palette.white,
    rule: palette.border,
    heading: palette.midnight950,
    text: palette.slate900,
    muted: palette.slate700,
    link: palette.blue700,
    action: palette.blue700,
    actionText: palette.white,
    intentBg: palette.blue50,
    intentText: palette.blue700,
    intentBorder: palette.blue100,
    timeBg: palette.aqua50,
    timeText: palette.midnight800,
    timeBorder: palette.aqua600,
    quoteBg: palette.cloud50,
    quoteBar: palette.blue600,
    codeBg: palette.cloud50,
    hintBg: palette.white,
    hintText: palette.warning,
    hintBorder: palette.warning,
    headBg: palette.midnight950,
    headText: palette.white,
    headLabelBg: palette.midnight800,
    headLabelText: palette.cloud50,
  },
  dark: {
    page: palette.midnight950,
    surface: palette.midnight800,
    rule: palette.slate700,
    heading: palette.white,
    text: palette.cloud50,
    muted: palette.border,
    link: palette.white,
    // Blue on midnight is about 3.3:1, so the dark primary is a light fill (as on the site).
    action: palette.white,
    actionText: palette.midnight950,
    intentBg: palette.midnight950,
    intentText: palette.blue100,
    intentBorder: palette.blue600,
    timeBg: palette.midnight950,
    timeText: palette.aqua50,
    timeBorder: palette.aqua600,
    quoteBg: palette.midnight950,
    quoteBar: palette.blue600,
    codeBg: palette.midnight950,
    hintBg: palette.midnight950,
    hintText: palette.white,
    hintBorder: palette.warning,
    headBg: palette.midnight950,
    headText: palette.white,
    headLabelBg: palette.midnight800,
    headLabelText: palette.cloud50,
  },
} as const;

type Role = keyof typeof emailTheme.light;
const L = emailTheme.light;
const D = emailTheme.dark;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

/** Dark-mode overrides: class → CSS property → colour role. */
const DARK_CLASSES: Record<
  string,
  Partial<Record<"background-color" | "color" | "border-color", Role>>
> = {
  "v-page": { "background-color": "page" },
  "v-card": { "background-color": "surface", "border-color": "rule" },
  "v-rule": { "border-color": "rule" },
  "v-h": { color: "heading" },
  "v-t": { color: "text" },
  "v-m": { color: "muted" },
  "v-link": { color: "link" },
  "v-btn": { "background-color": "action" },
  "v-btn-a": { color: "actionText" },
  "v-b-intent": {
    "background-color": "intentBg",
    color: "intentText",
    "border-color": "intentBorder",
  },
  "v-b-time": { "background-color": "timeBg", color: "timeText", "border-color": "timeBorder" },
  "v-b-none": { "background-color": "surface", color: "muted", "border-color": "rule" },
  "v-quote": { "background-color": "quoteBg" },
  "v-code": { "background-color": "codeBg", color: "heading" },
  "v-hint": { "background-color": "hintBg", color: "hintText", "border-color": "hintBorder" },
};

function darkCss(): { media: string; outlook: string } {
  const media: string[] = [];
  const outlook: string[] = [];
  for (const [cls, props] of Object.entries(DARK_CLASSES)) {
    const decls = Object.entries(props).map(([prop, role]) => `${prop}:${D[role]} !important`);
    media.push(`.${cls}{${decls.join(";")}}`);
    // Outlook.com marks rewritten text colours with data-ogsc and backgrounds with data-ogsb.
    for (const [prop, role] of Object.entries(props)) {
      const scope = prop === "color" ? "[data-ogsc]" : "[data-ogsb]";
      outlook.push(`${scope} .${cls}{${prop}:${D[role]} !important}`);
    }
  }
  return {
    media: `@media (prefers-color-scheme:dark){${media.join("")}}`,
    outlook: outlook.join("\n"),
  };
}

const dark = darkCss();

/**
 * Three style blocks: Gmail discards a whole block when it meets a rule it does not support, so
 * the layout rules are kept apart from the dark-mode query and from attribute selectors.
 */
const STYLE_BLOCKS = [
  [
    "body{margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}",
    "table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}",
    "@media (max-width:480px){.v-pad{padding-left:16px !important;padding-right:16px !important}.v-name{font-size:22px !important;line-height:28px !important}.v-label{width:104px !important}}",
  ].join("\n"),
  dark.media,
  [
    ":root{color-scheme:light dark;supported-color-schemes:light dark}",
    "a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important}",
    dark.outlook,
  ].join("\n"),
];

// Zero-width padding so the client does not pull body text into the inbox preview.
const PREHEADER_PAD = "&#8199;&#65279;&#847; ".repeat(60);

const muted = (text: string) =>
  `<span class="v-m" style="color:${L.muted};font-style:italic;">${escapeHtml(text)}</span>`;
const valueOr = (value: string) => (value ? escapeHtml(value) : muted(NOT_PROVIDED));
const rawNote = (raw: string) =>
  ` <span class="v-m" style="color:${L.muted};font-family:${MONO};font-size:13px;">(${escapeHtml(raw)})</span>`;
const labelledHtml = (label: string, raw: string) =>
  !raw ? muted(NOT_PROVIDED) : label === raw ? escapeHtml(raw) : escapeHtml(label) + rawNote(raw);

/** An inline (CID) image. Alt text inherits the cell's font and colour when images are off. */
function image(img: InlineImage, alt: string): string {
  return `<img src="cid:${img.contentId}" width="${img.width}" height="${img.height}" alt="${escapeHtml(alt)}" style="display:block;width:${img.width}px;height:${img.height}px;border:0;outline:none;text-decoration:none;">`;
}

function link(href: string, text: string): string {
  // inline-block with 12px vertical padding: a tap target of at least 44px.
  return `<a href="${escapeHtml(href)}" class="v-link" style="display:inline-block;padding:12px 0;color:${L.link};text-decoration:underline;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(text)}</a>`;
}

const CELL = `border-top:1px solid ${L.rule};font-size:16px;line-height:20px;vertical-align:top;`;

/** A label/value row. `linked` rows carry their padding on the link to enlarge the tap target. */
function row(label: string, valueHtml: string, opts: { linked?: boolean } = {}): string {
  return `<tr>
<th scope="row" align="left" valign="top" width="128" class="v-m v-rule v-label" style="${CELL}width:128px;padding:12px 12px 12px 0;font-weight:400;font-size:14px;color:${L.muted};">${escapeHtml(label)}</th>
<td valign="top" class="v-t v-rule" style="${CELL}padding:${opts.linked ? "0" : "12px 0"};color:${L.text};word-break:break-word;overflow-wrap:anywhere;">${valueHtml}</td>
</tr>`;
}

function section(title: string, inner: string): string {
  return `<tr><td style="padding:28px 0 0;">
<h2 class="v-h" style="margin:0 0 8px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${L.heading};">${escapeHtml(title)}</h2>
${inner}
</td></tr>`;
}

function detailsTable(rows: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-family:${FONT};">
${rows.join("\n")}
</table>`;
}

function badge(text: string, kind: "intent" | "time" | "none"): string {
  const [bg, fg, border] =
    kind === "intent"
      ? [L.intentBg, L.intentText, L.intentBorder]
      : kind === "time"
        ? [L.timeBg, L.timeText, L.timeBorder]
        : [L.surface, L.muted, L.rule];
  return `<span class="v-b-${kind}" style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border:1px solid ${border};border-radius:999px;background-color:${bg};color:${fg};font-size:14px;line-height:20px;font-weight:600;white-space:nowrap;">${escapeHtml(text)}</span>`;
}

export function buildHtmlBody(message: NotificationMessage): string {
  const v = toView(message);
  const subject = buildSubject(message);

  const badges = [
    v.intentLabel ? badge(v.intentLabel, "intent") : badge("Intent not provided", "none"),
    v.timeframeLabel ? badge(v.timeframeLabel, "time") : badge("Timeframe not provided", "none"),
  ].join("");

  const replyButton = v.replyable
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
<tr><td align="center" bgcolor="${L.action}" class="v-btn" style="background-color:${L.action};border-radius:8px;">
<a href="${escapeHtml(mailtoHref(v.workEmail, replySubject(v.reference)))}" class="v-btn-a" style="display:block;padding:14px 20px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${L.actionText};text-decoration:none;border-radius:8px;">Reply to ${escapeHtml(v.firstName || "the enquirer")}</a>
</td></tr></table>`
    : `<p class="v-m" style="margin:0;font-size:14px;line-height:20px;color:${L.muted};">No valid reply address was provided, so there is no reply button.</p>`;

  const goalHtml = v.goal ? escapeHtml(v.goal).replace(/\n/g, "<br>\n") : muted(NOT_PROVIDED);

  const emailHtml = v.workEmail
    ? (v.replyable
        ? link(mailtoHref(v.workEmail), v.workEmail)
        : `<span style="display:inline-block;padding:12px 0;">${escapeHtml(v.workEmail)}</span>`) +
      (v.personalDomain
        ? `<div style="padding:0 0 12px;"><span class="v-hint" style="display:inline-block;padding:2px 8px;border:1px solid ${L.hintBorder};border-radius:999px;background-color:${L.hintBg};color:${L.hintText};font-size:14px;line-height:20px;font-weight:600;">Personal email domain</span></div>`
        : "")
    : `<span style="display:inline-block;padding:12px 0;">${muted(NOT_PROVIDED)}</span>`;

  const sourceHtml = v.sourceUrl
    ? link(v.sourceUrl, v.sourceUrl)
    : `<span style="display:inline-block;padding:12px 0;">${valueOr(v.sourcePath)}</span>`;

  const receivedHtml = v.receivedUk
    ? `${escapeHtml(v.receivedUk)}<br><span class="v-m" style="color:${L.muted};font-family:${MONO};font-size:13px;line-height:20px;">${escapeHtml(
        v.receivedRaw,
      )
        .replace(/T(?=\d)/, "T<wbr>")
        .replace(/([+-]\d\d:\d\d|Z)$/, "<wbr>$1")}</span>`
    : valueOr(v.receivedRaw);

  const referenceHtml = v.reference
    ? `<span class="v-code" style="display:inline-block;padding:4px 8px;border-radius:6px;background-color:${L.codeBg};color:${L.heading};font-family:${MONO};font-size:16px;line-height:20px;letter-spacing:0.5px;-webkit-user-select:all;user-select:all;">${escapeHtml(v.reference)}</span>`
    : muted(NOT_PROVIDED);

  const contactRows = [
    row("Name", valueOr(v.name)),
    row("Organisation", valueOr(v.organisation)),
    row("Work email", emailHtml, { linked: true }),
    v.role ? row("Role", escapeHtml(v.role)) : undefined,
  ].filter((r) => r !== undefined);

  const enquiryRows = [
    row("Intent", labelledHtml(v.intentLabel, v.intentRaw)),
    row("Timeframe", labelledHtml(v.timeframeLabel, v.timeframeRaw)),
    v.budgetRange ? row("Budget range", escapeHtml(v.budgetRange)) : undefined,
    v.offer ? row("Offer", escapeHtml(v.offer)) : undefined,
    row("Source page", sourceHtml, { linked: true }),
  ].filter((r) => r !== undefined);

  const metaRows = [row("Reference", referenceHtml), row("Received", receivedHtml)];

  return `<!DOCTYPE html>
<html lang="en-GB" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
${STYLE_BLOCKS.map((css) => `<style>\n${css}\n</style>`).join("\n")}
</head>
<body class="v-page" style="margin:0;padding:0;background-color:${L.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;opacity:0;">${escapeHtml(buildPreheader(message))}${PREHEADER_PAD}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.page}" class="v-page" style="width:100%;background-color:${L.page};">
<tr><td align="center" style="padding:16px 8px 24px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${FONT};">
<tr><td bgcolor="${L.headBg}" class="v-pad" style="padding:16px 24px;background-color:${L.headBg};background-image:linear-gradient(${L.headBg},${L.headBg});border-radius:12px 12px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
<tr>
<td style="font-family:${FONT};font-size:20px;line-height:24px;font-weight:700;color:${L.headText};">${image(inlineImages.logo, "Vitalos")}</td>
<td align="right" style="font-family:${FONT};"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${L.headLabelBg};color:${L.headLabelText};font-size:14px;line-height:20px;font-weight:600;">New enquiry</span></td>
</tr></table>
</td></tr>
<tr><td bgcolor="${L.surface}" class="v-card v-pad" style="padding:24px;background-color:${L.surface};border:1px solid ${L.rule};border-top:0;border-radius:0 0 12px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-family:${FONT};">
<tr><td>
<h1 class="v-h v-name" style="margin:0;font-family:${FONT};font-size:24px;line-height:30px;font-weight:700;color:${L.heading};word-break:break-word;overflow-wrap:anywhere;">${valueOr(v.name)}</h1>
<p class="v-m" style="margin:4px 0 0;font-size:16px;line-height:24px;color:${L.muted};word-break:break-word;overflow-wrap:anywhere;">${v.organisation ? escapeHtml(v.organisation) : muted("Organisation not provided")}</p>
<div style="margin:12px 0 0;">${badges}</div>
</td></tr>
<tr><td style="padding:14px 0 0;">
${replyButton}
</td></tr>
${section(
  "Goal",
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
<tr><td class="v-quote v-t" style="padding:12px 16px;background-color:${L.quoteBg};border-left:4px solid ${L.quoteBar};font-family:${FONT};font-size:16px;line-height:24px;color:${L.text};word-break:break-word;overflow-wrap:anywhere;">${goalHtml}</td></tr>
</table>`,
)}
${section("Contact details", detailsTable(contactRows))}
${section("Enquiry details", detailsTable(enquiryRows))}
${section("Meta", detailsTable(metaRows))}
</table>
</td></tr>
<tr><td class="v-m v-pad" style="padding:16px 24px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${L.muted};">${escapeHtml(FOOTER_NOTE)}</td></tr>
<tr><td class="v-pad" style="padding:12px 18px 0;">${socialLinks
    .map(
      (s) =>
        `<a href="${escapeHtml(s.url)}" style="display:inline-block;padding:6px;text-decoration:none;">${image(s.image, `Vitalos on ${s.label}`)}</a>`,
    )
    .join("")}</td></tr>
<tr><td class="v-m v-pad" style="padding:8px 24px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${L.muted};">${escapeHtml(COMPANY_LINE)}<br>${escapeHtml(ADDRESS_LINE)}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}

export interface RenderedNotification {
  subject: string;
  text: string;
  html: string;
  /** Images the HTML references as `cid:`; send them as inline attachments. */
  inlineImages: InlineImage[];
}

export function renderEnquiryNotification(message: NotificationMessage): RenderedNotification {
  return {
    subject: buildSubject(message),
    text: buildTextBody(message),
    html: buildHtmlBody(message),
    inlineImages: [inlineImages.logo, ...socialLinks.map((s) => s.image)],
  };
}
