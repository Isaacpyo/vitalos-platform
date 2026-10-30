import { palette } from "@vitalos/design-tokens";

/**
 * Colour roles per theme, from the locked design tokens. Text/background pairs are checked for
 * WCAG AA in the tests. The light theme is inline; the dark theme is applied by class through
 * `prefers-color-scheme` (Apple Mail, iOS Mail) and Outlook.com's `data-ogsc`/`data-ogsb`.
 */
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
    // The light accent used on dark surfaces (as the intent badge text): 10.47:1 on the card and
    // 13.92:1 on the page. Links are underlined too, so colour is never the only cue.
    link: palette.blue100,
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

export type ColourRole = keyof typeof emailTheme.light;

export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

/** Dark-mode overrides: class → CSS property → colour role. */
const DARK_CLASSES: Record<
  string,
  Partial<Record<"background-color" | "color" | "border-color", ColourRole>>
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
    const decls = Object.entries(props).map(
      ([prop, role]) => `${prop}:${emailTheme.dark[role]} !important`,
    );
    media.push(`.${cls}{${decls.join(";")}}`);
    // Outlook.com marks rewritten text colours with data-ogsc and backgrounds with data-ogsb.
    for (const [prop, role] of Object.entries(props)) {
      const scope = prop === "color" ? "[data-ogsc]" : "[data-ogsb]";
      outlook.push(`${scope} .${cls}{${prop}:${emailTheme.dark[role]} !important}`);
    }
  }
  return {
    // `a` first: a link the email client made itself (see STYLE_BLOCKS) takes the dark link colour.
    media: `@media (prefers-color-scheme:dark){a{color:${emailTheme.dark.link}}${media.join("")}}`,
    outlook: outlook.join("\n"),
  };
}

const dark = darkCss();

/**
 * Three style blocks: Gmail discards a whole block when it meets a rule it does not support, so
 * the layout rules are kept apart from the dark-mode query and from attribute selectors.
 *
 * The `a` rule is a fallback for links the email client makes itself (an address it detects in
 * text): they get the layout's link colour and underline instead of the client's default blue.
 * Every link the layout writes carries the same colour inline, which wins over this rule.
 */
export const STYLE_BLOCKS: readonly string[] = [
  [
    "body{margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}",
    "table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}",
    `a{color:${emailTheme.light.link};text-decoration:underline}`,
    "@media (max-width:480px){.v-pad{padding-left:16px !important;padding-right:16px !important}.v-name{font-size:22px !important;line-height:28px !important}.v-label{width:104px !important}}",
  ].join("\n"),
  dark.media,
  [
    ":root{color-scheme:light dark;supported-color-schemes:light dark}",
    "a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important}",
    dark.outlook,
  ].join("\n"),
];

/** The `@media` query a preview replaces to force the dark (or light) theme. */
export const DARK_MEDIA_QUERY = "@media (prefers-color-scheme:dark)";

// Zero-width padding so the client does not pull body text into the inbox preview.
export const PREHEADER_PAD = "&#8199;&#65279;&#847; ".repeat(60);
