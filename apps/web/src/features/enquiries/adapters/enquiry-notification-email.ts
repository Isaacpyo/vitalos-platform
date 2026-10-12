import { repoSettingsFacts } from "@vitalos/cms/repo";
import { cleanLine, cleanMultiline, renderEmail, truncate } from "@vitalos/email-layout";
import type {
  Block,
  DetailRow,
  EmailDocument,
  InlineImage,
  SocialLink,
} from "@vitalos/email-layout";
import type { EnquiryIntent, EnquiryTimeframe } from "@vitalos/validation/enquiry";
import type { NotificationMessage } from "../domain/ports";

export { cleanLine, cleanMultiline, escapeHtml } from "@vitalos/email-layout";

/**
 * The internal "new enquiry" notification email: subject, plain-text part and HTML part, built on
 * the shared Vitalos email layout (`@vitalos/email-layout`). The notifier sends the parts as
 * multipart/alternative with the logo and icons as inline images. Pure functions, no I/O.
 *
 * Rendering rules:
 * - Every field of the enquiry is shown. An empty field reads "Not provided"; the row stays.
 *   Role, budget range and offer are shown only when present, as before (the form rarely sets them).
 * - Every value is cleaned and escaped by the layout. Single-line fields are folded onto one line,
 *   so they cannot fake extra fields or headers. The goal keeps its line breaks; in the plain-text
 *   part every goal line is quoted with "> " so it cannot pass for a field.
 * - The links are a `mailto:` to the enquirer, the public source page and the social profiles.
 */

export const FOOTER_NOTE =
  "Internal notification. The enquiry is stored in the Vitalos database; this email is not the record.";

/** Origin used to show the source page as a full link. The apex redirects to www. */
export const PUBLIC_SITE_ORIGIN = "https://vitalos.co.uk";

/** Social profiles supplied by the owner on 2026-10-12. Each has an inline icon. */
export const socialLinks: readonly SocialLink[] = [
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/vitalos",
    contentId: "social-linkedin",
  },
  { label: "X", url: "https://x.com/vitalos", contentId: "social-x" },
  { label: "Instagram", url: "https://www.instagram.com/vitalos", contentId: "social-instagram" },
  { label: "Facebook", url: "https://www.facebook.com/vitalos", contentId: "social-facebook" },
];

/** Company details for the footer, from the owner-published settings (Companies House record). */
const company = {
  legalName: repoSettingsFacts.legalName,
  companyNumber: repoSettingsFacts.companyNumber,
  registeredOffice: repoSettingsFacts.registeredAddress,
  website: PUBLIC_SITE_ORIGIN,
  supportEmail: repoSettingsFacts.contactEmail,
};

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

const labelFor = <K extends string>(labels: Record<K, string>, raw: string): string =>
  Object.hasOwn(labels, raw) ? labels[raw as K] : raw;

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

/** The raw value in brackets after its label, unless they are the same. */
const rawNote = (label: string, raw: string) => (raw && label !== raw ? raw : undefined);

/** The enquiry as layout blocks: summary card, reply button, goal, contact, enquiry and meta. */
export function buildDocument(message: NotificationMessage): EmailDocument {
  const v = toView(message);
  const replyBlock: Block = v.replyable
    ? {
        type: "button",
        label: `Reply to ${v.firstName || "the enquirer"}`,
        url: mailtoHref(v.workEmail, replySubject(v.reference)),
      }
    : {
        type: "text",
        tone: "muted",
        text: "No valid reply address was provided, so there is no reply button.",
      };

  const contactRows: DetailRow[] = [
    { label: "Name", value: v.name },
    { label: "Organisation", value: v.organisation },
    {
      label: "Work email",
      value: v.workEmail,
      href: v.replyable ? mailtoHref(v.workEmail) : undefined,
      hint: v.personalDomain ? "Personal email domain" : undefined,
    },
    ...(v.role ? [{ label: "Role", value: v.role }] : []),
  ];

  const enquiryRows: DetailRow[] = [
    { label: "Intent", value: v.intentLabel, note: rawNote(v.intentLabel, v.intentRaw) },
    {
      label: "Timeframe",
      value: v.timeframeLabel,
      note: rawNote(v.timeframeLabel, v.timeframeRaw),
    },
    ...(v.budgetRange ? [{ label: "Budget range", value: v.budgetRange }] : []),
    ...(v.offer ? [{ label: "Offer", value: v.offer }] : []),
    { label: "Source page", value: v.sourceUrl ?? v.sourcePath, href: v.sourceUrl },
  ];

  const metaRows: DetailRow[] = [
    { label: "Reference", value: v.reference, code: true },
    {
      label: "Received",
      value: v.receivedUk ?? v.receivedRaw,
      subvalue: v.receivedRaw || undefined,
      subvalueLabel: "raw",
    },
  ];

  return {
    title: buildSubject(message),
    preheader: buildPreheader(message),
    headerLabel: "New enquiry",
    blocks: [
      { type: "heading", text: v.name },
      { type: "text", tone: "muted", text: v.organisation, missing: "Organisation not provided" },
      {
        type: "badge",
        items: [
          v.intentLabel
            ? { text: v.intentLabel, tone: "intent" }
            : { text: "Intent not provided", tone: "none" },
          v.timeframeLabel
            ? { text: v.timeframeLabel, tone: "time" }
            : { text: "Timeframe not provided", tone: "none" },
        ],
      },
      replyBlock,
      { type: "section", text: "Goal" },
      { type: "quote", text: v.goal },
      { type: "section", text: "Contact details" },
      { type: "details", rows: contactRows },
      { type: "section", text: "Enquiry details" },
      { type: "details", rows: enquiryRows },
      { type: "section", text: "Meta" },
      { type: "details", rows: metaRows },
    ],
    footer: { notice: FOOTER_NOTE, social: [...socialLinks], company },
  };
}

/** Same sections, fields and order as the HTML part. */
export function buildTextBody(message: NotificationMessage): string {
  return renderEmail(buildDocument(message)).text;
}

export function buildHtmlBody(message: NotificationMessage): string {
  return renderEmail(buildDocument(message)).html;
}

export interface RenderedNotification {
  subject: string;
  text: string;
  html: string;
  /** Images the HTML references as `cid:`; send them as inline attachments. */
  inlineImages: InlineImage[];
}

export function renderEnquiryNotification(message: NotificationMessage): RenderedNotification {
  const rendered = renderEmail(buildDocument(message));
  return {
    subject: buildSubject(message),
    text: rendered.text,
    html: rendered.html,
    inlineImages: rendered.inlineImages,
  };
}
