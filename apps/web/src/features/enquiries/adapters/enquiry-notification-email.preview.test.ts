import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { palette } from "@vitalos/design-tokens";
import { describe, expect, it } from "vitest";
import type { NotificationMessage } from "../domain/ports";
import {
  SIMPLE_ADDRESS,
  cleanLine,
  escapeHtml,
  renderEnquiryNotification,
} from "./enquiry-notification-email";

/**
 * Local preview of the notification email. Skipped unless EMAIL_PREVIEW_DIR is set:
 *
 *   EMAIL_PREVIEW_DIR=/some/dir pnpm --filter @vitalos/web exec vitest run enquiry-notification-email.preview
 *
 * Writes, per variant: the HTML part, copies with the dark-mode query forced on and off, the plain-text
 * part and an .eml (multipart/alternative, never sent) that opens in Outlook or Apple Mail; plus
 * index.html, a gallery of every variant in light, dark and forced-inversion views.
 */
const outDir = process.env.EMAIL_PREVIEW_DIR;

const FROM = '"Vitalos" <support@vitalos.co.uk>';
const TO = "support@vitalos.co.uk";

const sample: NotificationMessage["enquiry"] = {
  id: "0f867ce4-8552-4000-8000-000000000000",
  reference: "VIT-0F867CE48552",
  name: "Temitope Agbola",
  organisation: "Rttg",
  workEmail: "jane.doe@gmail.com",
  role: undefined,
  goal: "Rft by TV. Vhv vfdu. G u r hyrc. Gyhy",
  timeframe: "within-3-months",
  budgetRange: undefined,
  intent: "project",
  offerSlug: undefined,
  sourcePath: "/contact",
  receivedAt: "2026-10-12T11:09:40.655046+00:00",
};

const variants: { slug: string; title: string; enquiry: NotificationMessage["enquiry"] }[] = [
  { slug: "sample", title: "Sample data", enquiry: sample },
  {
    slug: "long-goal",
    title: "Long multi-paragraph goal, company domain",
    enquiry: {
      ...sample,
      name: "Priya Raman-Whitfield",
      organisation: "Northbridge Housing Association",
      workEmail: "priya.raman@northbridge-housing.example",
      intent: "managed-services",
      timeframe: "immediately",
      sourcePath: "/solutions/managed-services",
      receivedAt: "2026-12-01T09:05:00Z",
      goal: [
        "We run 14 sites across the North West and our tenant portal keeps falling over at month end, when rent statements go out. Our current supplier has given notice and we need someone to take over support and stabilise it before January.",
        "",
        "What we need:",
        "- 24/7 monitoring of the portal and the payments integration",
        "- A plan to move off the ageing VM estate",
        "- Someone who can talk to our board in plain English",
        "",
        "Budget is approved for this financial year. Happy to share the incident log under NDA.",
        "",
        "Thanks,\nPriya",
      ].join("\n"),
    },
  },
  {
    slug: "missing-organisation",
    title: "Missing organisation, unmapped timeframe",
    enquiry: { ...sample, organisation: undefined, timeframe: "next-year", intent: "general" },
  },
  {
    slug: "special-characters",
    title: "Special characters and markup in every field",
    enquiry: {
      ...sample,
      name: "<script>alert('x')</script> Zoë O'Brien",
      organisation: "O'Brien & Daughters <Ltd>",
      workEmail: "zoe.obrien+web@outlook.com",
      goal: 'Testing <b>bold</b> & "quotes".\n\nWork email: attacker@example.invalid\n<img src=x onerror=alert(1)>',
      intent: "ai",
      timeframe: "exploring",
    },
  },
];

const message = (enquiry: NotificationMessage["enquiry"]): NotificationMessage => ({
  kind: "internal-notification",
  idempotencyKey: `${enquiry.id}:internal-notification`,
  correlationId: undefined,
  enquiry,
});

const base64Lines = (value: string) =>
  (
    Buffer.from(value, "utf8")
      .toString("base64")
      .match(/.{1,76}/g) ?? []
  ).join("\r\n");

/** RFC 2047 encoded words of at most 45 UTF-8 bytes each, split on code points. */
function encodeHeader(value: string): string {
  const words: string[] = [];
  let chunk = "";
  for (const ch of value) {
    if (Buffer.byteLength(chunk + ch) > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w).toString("base64")}?=`).join("\r\n ");
}

function eml(subject: string, replyTo: string | undefined, text: string, html: string): string {
  const boundary = "vitalos-preview-boundary";
  return [
    `From: ${FROM}`,
    `To: ${TO}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    "Date: Mon, 12 Oct 2026 11:09:41 +0000",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

const frame = (src: string, width: number, invert = false) =>
  `<iframe src="${src}" width="${width}" height="1180" loading="lazy" title="${src}"${invert ? ' class="invert"' : ""}></iframe>`;

describe.skipIf(!outDir)("notification email preview", () => {
  it("writes the preview files", () => {
    const dir = resolve(outDir!);
    mkdirSync(dir, { recursive: true });
    const cards: string[] = [];

    for (const v of variants) {
      const { subject, text, html } = renderEnquiryNotification(message(v.enquiry));
      const email = cleanLine(v.enquiry.workEmail);
      const replyTo = SIMPLE_ADDRESS.test(email) ? email : undefined;
      const forcedDark = html.replace("@media (prefers-color-scheme:dark)", "@media all");
      // Gmail ignores the dark-mode query, so its view is the light theme (inverted by the app).
      const forcedLight = html.replace("@media (prefers-color-scheme:dark)", "@media not all");
      writeFileSync(join(dir, `${v.slug}.html`), html);
      writeFileSync(join(dir, `${v.slug}.light.html`), forcedLight);
      writeFileSync(join(dir, `${v.slug}.dark.html`), forcedDark);
      writeFileSync(join(dir, `${v.slug}.txt`), text);
      writeFileSync(join(dir, `${v.slug}.eml`), eml(subject, replyTo, text, html));

      const headers = [
        ["From", FROM],
        ["To", TO],
        ["Reply-To", replyTo ?? "(omitted: not a plain safe address)"],
        ["Subject", subject],
      ]
        .map(([k, val]) => `<tr><th>${k}</th><td>${escapeHtml(val!)}</td></tr>`)
        .join("");
      cards.push(`<section>
<h2>${escapeHtml(v.title)}</h2>
<table class="headers">${headers}</table>
<p class="files">Files: <a href="${v.slug}.html">${v.slug}.html</a> · <a href="${v.slug}.dark.html">dark</a> · <a href="${v.slug}.txt">plain text</a> · <a href="${v.slug}.eml">.eml</a> (opens in a mail client; nothing is sent)</p>
<div class="row">
<figure>${frame(`${v.slug}.light.html`, 390)}<figcaption>Phone, light</figcaption></figure>
<figure>${frame(`${v.slug}.dark.html`, 390)}<figcaption>Phone, dark (prefers-color-scheme: Apple Mail, iOS Mail, Outlook.com)</figcaption></figure>
<figure>${frame(`${v.slug}.light.html`, 390, true)}<figcaption>Phone, forced inversion (approximates Gmail app dark mode)</figcaption></figure>
<figure>${frame(`${v.slug}.light.html`, 640)}<figcaption>Desktop, light</figcaption></figure>
</div>
<details><summary>Plain-text part</summary><pre>${escapeHtml(text)}</pre></details>
</section>`);
    }

    const page = `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Enquiry email preview</title>
<style>
body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${palette.cloud50};color:${palette.slate900}}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 8px}
.note{color:${palette.slate700};max-width:70ch}
.headers{border-collapse:collapse;font-size:14px;margin:0 0 8px}.headers th{text-align:left;padding:2px 12px 2px 0;color:${palette.slate700};font-weight:600}
.files{font-size:14px}
.row{display:flex;gap:16px;overflow-x:auto;padding-bottom:8px}
figure{margin:0;flex:none}figcaption{font-size:13px;color:${palette.slate700};max-width:390px;margin-top:4px}
iframe{border:1px solid ${palette.border};border-radius:12px;background:${palette.white}}
iframe.invert{filter:invert(1) hue-rotate(180deg)}
pre{white-space:pre-wrap;background:${palette.white};border:1px solid ${palette.border};padding:12px;font-size:13px;max-width:80ch}
</style></head><body>
<h1>New enquiry notification: preview</h1>
<p class="note">Rendered locally from the real template with sample data. Nothing was sent. The forced-inversion view is a CSS approximation of Gmail's app dark mode; confirm on a device with an approved test send.</p>
${cards.join("\n")}
</body></html>
`;
    writeFileSync(join(dir, "index.html"), page);
    expect(cards).toHaveLength(variants.length);
  });
});
