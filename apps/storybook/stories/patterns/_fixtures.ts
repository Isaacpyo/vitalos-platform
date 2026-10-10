/**
 * Obviously artificial fixture content for pattern stories. Never real marketing copy, clients,
 * metrics, people or evidence. URLs use the reserved .invalid TLD.
 */
import type { PatternImage, SiteNavItem, SiteNavLink } from "@vitalos/ui";

export const url = (path: string) => `https://example.invalid/${path}`;

export const text = {
  title: "Example practice (fixture)",
  longTitle:
    "Example title (fixture) that is deliberately long so it wraps over many lines and tests balance, wrapping and spacing at 320 pixels",
  summary:
    "Example summary (fixture). Placeholder text used only to exercise layout, wrapping and contrast. It is not product copy.",
  shortSummary: "Example short summary (fixture).",
  longWord:
    "Example-unbroken-token-(fixture)-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  label: "Example label (fixture)",
  source: "Example source (fixture)",
  person: "Example Person",
  role: "Example role (fixture)",
} as const;

/** A tiny inline SVG as a data URI: no network, no real imagery. */
export const sampleImage = (alt: string, width = 640, height = 400): PatternImage => ({
  url:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="lightgray"/></svg>`,
    ),
  alt,
  width,
  height,
});

const child = (n: number): SiteNavLink => ({
  label: `Example link ${n} (fixture)`,
  href: url(`link-${n}`),
});

export const navItems: SiteNavItem[] = [
  {
    key: "section-one",
    label: "One (fixture)",
    href: url("section-one"),
    menu: {
      columns: [
        {
          key: "practices",
          heading: "Example practices (fixture)",
          href: url("practices"),
          links: [1, 2, 3, 4, 5].map(child),
        },
        {
          key: "solutions",
          heading: "Example solutions (fixture)",
          href: url("solutions"),
          links: [
            { ...child(6), description: "Example description (fixture)" },
            { label: text.longTitle, href: url("long") },
          ],
        },
        { key: "offers", heading: "Example offers (fixture)", links: [child(8), child(9)] },
        { key: "explore", heading: "Example explore (fixture)", links: [child(10)] },
      ],
    },
  },
  { key: "section-two", label: "Two (fixture)", href: url("section-two") },
  { key: "section-three", label: "Three (fixture)", href: url("section-three") },
  { key: "section-four", label: "Four (fixture)", href: url("section-four") },
  { key: "section-five", label: "Five (fixture)", href: url("section-five") },
];

export const utilityLinks: SiteNavLink[] = [
  { label: "Example utility (fixture)", href: url("utility") },
];

export const cta = { label: "Example action (fixture)", href: url("contact") };

export const metric = {
  value: "00%",
  descriptor: "Example measure (fixture)",
  source: text.source,
  context: "Example scope (fixture)",
  timeframe: "Example period (fixture)",
};
