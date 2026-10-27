/**
 * Renders the TypeScript emails (website enquiry notification, Relay visitor email) for the email
 * gallery (`superadmin manage.py email_gallery --import <dir>`). Fictional data only.
 *
 *   pnpm --filter @vitalos/web exec tsx scripts/email-gallery.ts <out-dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { visitorReplyEmail } from "@vitalos/relay-core";
import type { NotificationMessage } from "../src/features/enquiries/domain/ports";
import { renderEnquiryNotification } from "../src/features/enquiries/adapters/enquiry-notification-email";

const out = resolve(process.argv[2] ?? "email-gallery-ts");
mkdirSync(out, { recursive: true });

const enquiry: NotificationMessage["enquiry"] = {
  id: "0f867ce4-8552-4000-8000-000000000000",
  reference: "VIT-EXAMPLE-01",
  name: "Alex Example",
  organisation: "Example Care Group",
  workEmail: "alex@example-care.example",
  role: undefined,
  goal: "We need a new website for our care homes by spring, with a booking form for visits.",
  timeframe: "within-3-months",
  budgetRange: undefined,
  intent: "project",
  offerSlug: undefined,
  sourcePath: "/contact",
  receivedAt: "2026-10-26T09:12:00Z",
};

const message = {
  kind: "internal-notification",
  correlationId: "example-correlation",
  idempotencyKey: "example:internal-notification",
  enquiry,
} as unknown as NotificationMessage;

const emails: { slug: string; name: string; subject: string; html: string; text: string }[] = [];
const web = renderEnquiryNotification(message);
emails.push({ slug: "web-enquiry-notification", name: "Website enquiry notification", ...web });
const relay = visitorReplyEmail({
  visitorName: "Alex Example",
  adminName: "Sam Example",
  reply: "Thanks for waiting. Yes, we can look at your booking form this week.",
  resumeUrl: "https://vitalos.co.uk/?relay=resume&t=EXAMPLE",
  privacyUrl: "https://vitalos.co.uk/privacy",
});
emails.push({ slug: "relay-visitor-reply", name: "Relay visitor reply", ...relay });

const manifest = emails.map((email) => {
  writeFileSync(join(out, `${email.slug}.html`), email.html);
  writeFileSync(join(out, `${email.slug}.txt`), email.text);
  return {
    slug: email.slug,
    name: email.name,
    repo: "vitalos-platform",
    category: "system",
    state: "layout",
    subject: email.subject,
    html: `${email.slug}.html`,
    text: `${email.slug}.txt`,
  };
});
writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifest.length} emails to ${out}`);
