import { contrastRatio } from "@vitalos/design-tokens";
import { describe, expect, it } from "vitest";
import type { NotificationMessage } from "../domain/ports";
import {
  FOOTER_NOTE,
  buildHtmlBody,
  buildPreheader,
  buildSubject,
  buildTextBody,
  emailTheme,
  formatUkTime,
  isPersonalEmailDomain,
  renderEnquiryNotification,
  sourcePageUrl,
} from "./enquiry-notification-email";

const message = (overrides: Partial<NotificationMessage["enquiry"]> = {}): NotificationMessage => ({
  kind: "internal-notification",
  idempotencyKey: "fixture:internal-notification",
  correlationId: undefined,
  enquiry: {
    id: "0f867ce4-8552-4000-8000-000000000000",
    reference: "VIT-0F867CE48552",
    name: "Example Person",
    organisation: "Example Organisation",
    workEmail: "person@example.invalid",
    role: undefined,
    goal: "Clearly artificial non-production enquiry fixture used by automated tests.",
    timeframe: "within-3-months",
    budgetRange: undefined,
    intent: "project",
    offerSlug: undefined,
    sourcePath: "/contact",
    receivedAt: "2026-10-12T11:09:40.655046+00:00",
    ...overrides,
  },
});

/** Visible text of the HTML part, in document order (tags and the hidden preheader removed). */
const visibleText = (html: string) =>
  html
    .replace(/<head>[\s\S]*<\/head>/, "")
    .replace(/<div style="display:none[\s\S]*?<\/div>/, "")
    .replace(/<wbr>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

describe("subject and preheader", () => {
  it("subject: intent label, name and organisation, reference", () => {
    expect(buildSubject(message())).toBe(
      "New enquiry: New project · Example Person, Example Organisation · VIT-0F867CE48552",
    );
  });

  it("subject drops the organisation when missing and falls back to the raw intent", () => {
    expect(buildSubject(message({ organisation: undefined, intent: "unmapped-intent" }))).toBe(
      "New enquiry: unmapped-intent · Example Person · VIT-0F867CE48552",
    );
    expect(buildSubject(message({ intent: undefined }))).toMatch(
      /^New enquiry: Intent not provided · /,
    );
  });

  it("subject is one line and plain text (no HTML escaping in a header)", () => {
    const subject = buildSubject(message({ name: "Zoë O'Brien\r\nBcc: x@example.invalid" }));
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain("Zoë O'Brien Bcc: x@example.invalid");
  });

  it("preheader: timeframe label and the first 80 characters of the goal", () => {
    const goal = `${"a".repeat(100)}`;
    expect(buildPreheader(message({ goal }))).toBe(`Within 3 months · ${"a".repeat(79)}…`);
    expect(buildPreheader(message({ goal: "Short\ngoal" }))).toBe("Within 3 months · Short goal");
  });

  it("the preheader is in the HTML part, hidden", () => {
    const html = buildHtmlBody(message());
    expect(html).toMatch(/<div style="display:none;[^"]*">Within 3 months · Clearly artificial/);
  });
});

describe("all fields, in the same order in both parts", () => {
  const order = [
    "Example Person",
    "Example Organisation",
    "New project",
    "Within 3 months",
    "Reply to Example",
    "Goal",
    "Clearly artificial non-production enquiry",
    "Contact details",
    "Name",
    "Organisation",
    "Work email",
    "person@example.invalid",
    "Enquiry details",
    "Intent",
    "project",
    "Timeframe",
    "within-3-months",
    "Source page",
    "https://vitalos.co.uk/contact",
    "Meta",
    "Reference",
    "VIT-0F867CE48552",
    "Received",
    "Mon 12 Oct 2026, 12:09 BST",
    "2026-10-12T11:09:40.655046+00:00",
    FOOTER_NOTE,
  ];

  const inOrder = (text: string) => {
    let at = 0;
    for (const needle of order) {
      const found = text.toLowerCase().indexOf(needle.toLowerCase(), at);
      expect(found, `"${needle}" after position ${at}`).toBeGreaterThanOrEqual(0);
      at = found + needle.length;
    }
  };

  it("HTML", () => inOrder(visibleText(buildHtmlBody(message()))));
  it("plain text", () => inOrder(buildTextBody(message())));

  it("footer note word for word in both parts", () => {
    const { text, html } = renderEnquiryNotification(message());
    expect(text.endsWith(`\n${FOOTER_NOTE}`)).toBe(true);
    expect(html).toContain(FOOTER_NOTE);
  });

  it("role, budget range and offer appear when present, as before", () => {
    const rendered = renderEnquiryNotification(
      message({ role: "CTO", budgetRange: "band-1", offerSlug: "ai-readiness" }),
    );
    for (const part of [rendered.text, visibleText(rendered.html)]) {
      expect(part).toContain("Role");
      expect(part).toContain("CTO");
      expect(part).toContain("Budget range");
      expect(part).toContain("band-1");
      expect(part).toContain("Offer");
      expect(part).toContain("ai-readiness");
    }
  });

  it("plain-text layout", () => {
    expect(buildTextBody(message())).toBe(
      [
        "VITALOS · NEW ENQUIRY",
        "",
        "Example Person, Example Organisation",
        "New project · Within 3 months",
        "",
        "Reply to Example: mailto:person@example.invalid?subject=Re%3A%20Your%20Vitalos%20enquiry%20(VIT-0F867CE48552)",
        "",
        "GOAL",
        "> Clearly artificial non-production enquiry fixture used by automated tests.",
        "",
        "CONTACT DETAILS",
        "Name: Example Person",
        "Organisation: Example Organisation",
        "Work email: person@example.invalid",
        "",
        "ENQUIRY DETAILS",
        "Intent: New project (project)",
        "Timeframe: Within 3 months (within-3-months)",
        "Source page: https://vitalos.co.uk/contact",
        "",
        "META",
        "Reference: VIT-0F867CE48552",
        "Received: Mon 12 Oct 2026, 12:09 BST",
        "Received (raw): 2026-10-12T11:09:40.655046+00:00",
        "",
        "--",
        FOOTER_NOTE,
      ].join("\n"),
    );
  });
});

describe("empty fields read Not provided and keep their row", () => {
  it("missing organisation, intent, timeframe and source page", () => {
    const m = message({
      organisation: undefined,
      intent: undefined,
      timeframe: "",
      sourcePath: undefined,
    });
    const text = buildTextBody(m);
    expect(text).toContain("Organisation: Not provided");
    expect(text).toContain("Intent: Not provided");
    expect(text).toContain("Timeframe: Not provided");
    expect(text).toContain("Source page: Not provided");
    const html = visibleText(buildHtmlBody(m));
    expect(html).toContain("Organisation not provided");
    expect(html).toContain("Intent not provided");
    expect(html).toContain("Timeframe not provided");
    expect(html.match(/Not provided/g)?.length).toBe(4);
  });
});

describe("reply", () => {
  it("button is a mailto to the enquirer with the reference in the subject", () => {
    const html = buildHtmlBody(
      message({ name: "Zoë O'Brien", workEmail: "zoe+sales@example.invalid" }),
    );
    expect(html).toContain(
      'href="mailto:zoe%2Bsales@example.invalid?subject=Re%3A%20Your%20Vitalos%20enquiry%20(VIT-0F867CE48552)"',
    );
    expect(html).toContain(">Reply to Zoë</a>");
  });

  it("no button and no link when the address is not a plain safe address", () => {
    const html = buildHtmlBody(
      message({ workEmail: "a@example.invalid\r\nBcc: x@example.invalid" }),
    );
    expect(html).not.toContain("mailto:");
    expect(html).toContain("No valid reply address was provided");
  });
});

describe("escaping", () => {
  const hostile = message({
    name: `<script>alert("x")</script> O'Brien & Zoë`,
    organisation: `<img src=x onerror=alert(1)>`,
    goal: `Line one <b>bold</b>\n\nWork email: attacker@example.invalid\n"quoted" & 'single'`,
    sourcePath: `/contact"><script>`,
    intent: `<i>unknown</i>`,
  });

  it("HTML escapes every user value", () => {
    const html = buildHtmlBody(hostile);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toContain("<b>bold</b>");
    expect(html).not.toContain("<i>unknown</i>");
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; O&#39;Brien &amp; Zoë",
    );
    expect(html).toContain(
      "Line one &lt;b&gt;bold&lt;/b&gt;<br>\n<br>\nWork email: attacker@example.invalid",
    );
  });

  it("source paths are percent-encoded; anything that is not a bare path is not linked", () => {
    expect(sourcePageUrl(`/contact"><script>`)).toBe(
      "https://vitalos.co.uk/contact%22%3E%3Cscript%3E",
    );
    expect(sourcePageUrl("//evil.example")).toBeUndefined();
    expect(sourcePageUrl("https://evil.example/")).toBeUndefined();
    expect(sourcePageUrl("/a b/é")).toBe("https://vitalos.co.uk/a%20b/%C3%A9");
  });

  it("plain text quotes goal lines so they cannot pass for fields", () => {
    const text = buildTextBody(hostile);
    expect(text).toContain("> Work email: attacker@example.invalid");
    expect(text.match(/^Work email: /gm)).toHaveLength(1);
  });

  it("control and bidi-override characters are removed", () => {
    const text = buildTextBody(message({ name: "Eve‮livah\u0007", goal: "a\u0000b\r\nc" }));
    expect(text).toContain("Name: Evelivah");
    expect(text).toContain("> ab\n> c");
  });
});

describe("labels and hints", () => {
  it("maps known values and falls back to the raw value", () => {
    expect(
      buildTextBody(message({ intent: "managed-services", timeframe: "exploring" })),
    ).toContain(
      "Intent: Managed services (managed-services)\nTimeframe: Still exploring (exploring)",
    );
    expect(buildTextBody(message({ intent: "brand-new", timeframe: "constructor" }))).toContain(
      "Intent: brand-new\nTimeframe: constructor",
    );
  });

  it.each([
    ["someone@gmail.com", true],
    ["someone@hotmail.co.uk", true],
    ["someone@outlook.com", true],
    ["someone@yahoo.fr", true],
    ["someone@icloud.com", true],
    ["someone@vitalos.co.uk", false],
    ["someone@gmail.example.invalid", false],
  ])("personal domain: %s → %s", (address, expected) => {
    expect(isPersonalEmailDomain(address)).toBe(expected);
  });

  it("shows the personal-domain hint in both parts", () => {
    const rendered = renderEnquiryNotification(message({ workEmail: "jane@gmail.com" }));
    expect(rendered.text).toContain("Work email: jane@gmail.com [Personal email domain]");
    expect(rendered.html).toContain(">Personal email domain</span>");
    expect(buildHtmlBody(message())).not.toContain("Personal email domain");
  });
});

describe("UK time", () => {
  it.each([
    ["2026-10-12T11:09:40.655046+00:00", "Mon 12 Oct 2026, 12:09 BST"],
    ["2026-12-01T09:05:00Z", "Tue 1 Dec 2026, 09:05 GMT"],
    ["2026-10-25T00:30:00Z", "Sun 25 Oct 2026, 01:30 BST"],
    ["2026-10-25T01:30:00Z", "Sun 25 Oct 2026, 01:30 GMT"],
  ])("%s → %s", (iso, expected) => {
    expect(formatUkTime(iso)).toBe(expected);
  });

  it("an unreadable timestamp is shown raw", () => {
    expect(formatUkTime("not a date")).toBeUndefined();
    expect(buildTextBody(message({ receivedAt: "not a date" }))).toContain(
      "Received: not a date\nReceived (raw): not a date",
    );
  });
});

describe("HTML constraints", () => {
  const html = buildHtmlBody(message({ workEmail: "jane@gmail.com" }));

  it("no scripts, images, external stylesheets, fonts or tracking", () => {
    expect(html).not.toMatch(/<script|<img|<link|<iframe|<object|<embed|@import|url\(|@font-face/i);
    expect(html).not.toMatch(/\ssrc=/i);
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/^(mailto:|https:\/\/vitalos\.co\.uk\/)/);
  });

  it("declares light and dark colour schemes and a dark-mode query", () => {
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain('<meta name="supported-color-schemes" content="light dark">');
    expect(html).toContain("@media (prefers-color-scheme:dark)");
    expect(html).toContain("[data-ogsc]");
  });

  it("600px single column, table layout, body text at least 14px", () => {
    expect(html).toContain("max-width:600px");
    expect(html).toContain('<table role="presentation" width="600"');
    const sizes = [...html.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
    // 13px is reserved for raw values and the raw timestamp; 1px is the hidden preheader.
    expect(sizes.filter((s) => s !== 1 && s !== 13).every((s) => s >= 14)).toBe(true);
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
