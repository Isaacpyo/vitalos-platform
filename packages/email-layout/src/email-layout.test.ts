import { readFileSync } from "node:fs";
import { contrastRatio } from "@vitalos/design-tokens";
import { describe, expect, it } from "vitest";
import { inlineImages } from "./images";
import { COMPANY_PLACEHOLDERS, renderEmail } from "./render";
import type { EmailDocument } from "./render";
import { layoutSpec } from "./spec";
import { emailTheme } from "./theme";

const company = {
  legalName: "Vitalos Technologies Limited",
  companyNumber: "16696895",
  registeredOffice: "114 High Street, Bentley, Doncaster, England, DN5 0AT",
  website: "https://vitalos.co.uk",
  supportEmail: "support@vitalos.co.uk",
};

const social = [
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/vitalos",
    contentId: "social-linkedin",
  },
  { label: "X", url: "https://x.com/vitalos", contentId: "social-x" },
];

/** JSON with bidi-override characters escaped, so no committed file contains them literally. */
const toJson = (value: unknown) =>
  `${JSON.stringify(value, null, 2).replace(
    /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
  )}\n`;

/** Golden fixtures: the Super Admin's Python renderer must produce byte-identical output. */
const fixtures: Record<string, EmailDocument> = {
  "all-blocks": {
    title: "Your proposal from Vitalos (VIT-0F867CE48552)",
    preheader: "Everything we discussed, priced and planned.",
    headerLabel: "Proposal",
    blocks: [
      { type: "heading", text: "Hi Temitope," },
      { type: "text", text: "Rttg", tone: "muted" },
      {
        type: "badge",
        items: ["Vitalos Consulting", "Within 3 months", { text: "Draft", tone: "none" }],
      },
      {
        type: "text",
        text: "Thanks for your time on Tuesday.\nHere is what we agreed.\n\n- Discovery in two weeks\n- A written roadmap\nThen a review.\n\nSpeak soon.",
      },
      { type: "button", label: "Read the proposal", url: "https://vitalos.co.uk/p/abc?x=1&y=2" },
      { type: "section", text: "Your words" },
      { type: "quote", text: "Line one\n\nLine three" },
      { type: "section", text: "Details" },
      {
        type: "details",
        rows: [
          {
            label: "Work email",
            value: "t@gmail.com",
            href: "mailto:t@gmail.com",
            hint: "Personal email domain",
          },
          { label: "Intent", value: "New project", note: "project" },
          { label: "Organisation", value: "" },
          { label: "Reference", value: "VIT-0F867CE48552", code: true },
          {
            label: "Received",
            value: "Mon 12 Oct 2026, 12:09 BST",
            subvalue: "2026-10-12T11:09:40.655046+00:00",
            subvalueLabel: "raw",
          },
        ],
      },
      { type: "divider" },
      { type: "signature", name: "Temitope Agbola", title: "Founder" },
    ],
    footer: {
      social,
      company,
      unsubscribe: {
        reason: "You are receiving this because you subscribed at vitalos.co.uk.",
        url: "https://vitalos.co.uk/unsubscribe?t=abc",
      },
    },
  },
  "hostile-and-missing": {
    title: `<script>alert("x")</script> O'Brien & Zoë`,
    preheader: "\u202Eevil\u0007 preheader",
    headerLabel: "Test <b>",
    blocks: [
      { type: "heading", text: "" },
      { type: "text", text: "<img src=x onerror=alert(1)>\r\nsecond line" },
      { type: "button", label: "Click", url: "javascript:alert(1)" },
      { type: "badge", items: ["", "Only one"] },
      { type: "quote", text: "" },
      { type: "details", rows: [{ label: "Site", value: "evil", href: "http://evil.example" }] },
      { type: "signature", name: "" },
    ],
    footer: {
      social: [{ label: "Bad", url: "javascript:alert(1)", contentId: "social-x" }],
      company: { legalName: "" },
      unsubscribe: { reason: "Because.", url: "not a url" },
    },
  },
  "internal-notice": {
    title: "New enquiry: New project · Example Person · VIT-0F867CE48552",
    preheader: "Within 3 months · Example goal",
    headerLabel: "New enquiry",
    blocks: [
      { type: "heading", text: "Example Person" },
      { type: "text", text: "A plain paragraph straight after a heading." },
      {
        type: "button",
        label: "Reply to Example",
        url: "mailto:person@example.invalid?subject=Re%3A%20Hi",
      },
    ],
    footer: {
      notice:
        "Internal notification. The enquiry is stored in the Vitalos database; this email is not the record.",
      social,
      company,
    },
  },
};

describe("golden fixtures (shared with the Super Admin renderer)", () => {
  it("layout spec", async () => {
    await expect(toJson(layoutSpec())).toMatchFileSnapshot(
      "../../../superadmin/email-layout/email-layout.json",
    );
  });

  for (const [name, doc] of Object.entries(fixtures)) {
    it(name, async () => {
      const rendered = renderEmail(doc);
      const base = `../../../superadmin/email-layout/fixtures/${name}`;
      await expect(toJson(doc)).toMatchFileSnapshot(`${base}.input.json`);
      await expect(rendered.html).toMatchFileSnapshot(`${base}.html`);
      await expect(rendered.text).toMatchFileSnapshot(`${base}.txt`);
      await expect(
        `${JSON.stringify(rendered.inlineImages.map((img) => img.contentId))}\n`,
      ).toMatchFileSnapshot(`${base}.images.json`);
    });
  }
});

describe("rendering", () => {
  const all = renderEmail(fixtures["all-blocks"]!);
  const hostile = renderEmail(fixtures["hostile-and-missing"]!);

  it("escapes every value and drops control and bidi characters", () => {
    const lowered = hostile.html.toLowerCase();
    for (const tag of ["<script", "<img src=x", "<b>"]) expect(lowered).not.toContain(tag);
    expect(hostile.html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; O&#39;Brien &amp; Zoë",
    );
    expect(hostile.html).toContain("&lt;img src=x onerror=alert(1)&gt;<br>\nsecond line");
    expect(hostile.html).toContain(">evil preheader");
  });

  it("renders only https and mailto links", () => {
    const hrefs = [...hostile.html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
    for (const href of hrefs) expect(href).toMatch(/^(https:|mailto:)/);
    expect(hostile.html).toContain("Click: link not available");
    expect(hostile.text).toContain("Click: link not available");
    expect(hostile.html).not.toContain("Vitalos on Bad");
    expect(hostile.text).toContain("Unsubscribe: reply to this email with the word unsubscribe");
  });

  it("shows placeholders for missing company facts and Not provided for empty values", () => {
    for (const placeholder of Object.values(COMPANY_PLACEHOLDERS)) {
      expect(hostile.html).toContain(placeholder);
      expect(hostile.text).toContain(placeholder);
    }
    expect(hostile.html).toContain(">Not provided</span>");
    expect(all.text).toContain("Organisation: Not provided");
  });

  it("text blocks: paragraphs, line breaks and bullet lists", () => {
    expect(all.html).toContain("Thanks for your time on Tuesday.<br>\nHere is what we agreed.");
    expect(all.html).toMatch(
      /<ul [^>]*><li [^>]*>Discovery in two weeks<\/li><li [^>]*>A written roadmap<\/li><\/ul>/,
    );
    expect(all.html).toContain(">Then a review.</p>");
  });

  it("marketing footer: reason and unsubscribe link in both parts", () => {
    expect(all.html).toContain('href="https://vitalos.co.uk/unsubscribe?t=abc"');
    expect(all.text).toContain(
      "You are receiving this because you subscribed at vitalos.co.uk.\nUnsubscribe: https://vitalos.co.uk/unsubscribe?t=abc",
    );
  });

  it("attaches the logo and only the social icons it uses", () => {
    expect(all.inlineImages.map((img) => img.contentId)).toEqual([
      "vitalos-logo",
      "social-linkedin",
      "social-x",
    ]);
    const cids = [...all.html.matchAll(/src="cid:([^"]+)"/g)].map((m) => m[1]);
    expect(cids).toEqual(["vitalos-logo", "social-linkedin", "social-x"]);
  });

  it("no scripts, remote images, external styles or fonts; text at least 14px", () => {
    for (const { html } of [all, hostile]) {
      expect(html).not.toMatch(/<script|<link|<iframe|<object|<embed|@import|url\(|@font-face/i);
      for (const m of html.matchAll(/\ssrc="([^"]*)"/g)) expect(m[1]).toMatch(/^cid:/);
      const sizes = [...html.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
      // 13px is reserved for raw values and timestamps; 1px is the hidden preheader and rules.
      expect(sizes.filter((s) => s !== 1 && s !== 13).every((s) => s >= 14)).toBe(true);
    }
  });
});

describe("inline images", () => {
  it("match the PNG files in ../assets at twice the display size", () => {
    for (const img of Object.values(inlineImages)) {
      const file = readFileSync(new URL(`../assets/${img.filename}`, import.meta.url));
      expect(img.base64).toBe(file.toString("base64"));
      expect([file.readUInt32BE(16), file.readUInt32BE(20)]).toEqual([
        img.width * 2,
        img.height * 2,
      ]);
    }
  });
});

describe("contrast (WCAG AA, 4.5:1 for text) in both themes", () => {
  const textPairs = [
    ["heading", "surface"],
    ["text", "surface"],
    ["muted", "surface"],
    ["muted", "page"],
    ["link", "surface"],
    ["actionText", "action"],
    ["intentText", "intentBg"],
    ["timeText", "timeBg"],
    ["text", "quoteBg"],
    ["muted", "quoteBg"],
    ["heading", "codeBg"],
    ["hintText", "hintBg"],
    ["headText", "headBg"],
    ["headLabelText", "headLabelBg"],
  ] as const;

  for (const [themeName, theme] of Object.entries(emailTheme)) {
    it.each(textPairs)(`${themeName}: %s on %s`, (fg, bg) => {
      expect(contrastRatio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
    });
  }
});
