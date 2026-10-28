/**
 * Vitalos AI & Data token scope (docs/ai-data/PLAN.md, AID-002; blueprint section 3.4): the
 * division section at /ai-data. Restrained and technical: near-black, white, cool greys and a
 * controlled blue-grey accent. The site's own tokens (./primitives.ts) are locked (ADR-008,
 * ADR-016) and are not changed; this scope sits beside them like the Relay scope (./relay.ts).
 *
 * Use:
 * - `data-aid-tone="dark|light|muted"` on a band sets the semantic `--aid-*` roles AND re-points
 *   the site's `--tone-*` roles at them, so shared @vitalos/ui components (buttons, form fields,
 *   status messages) inside the band take the AI & Data palette with verified contrast.
 * - Tailwind utilities read the roles: `bg-aid-bg`, `text-aid-text`, `border-aid-border`, ...
 *
 * ai-data.css is generated from this file; ai-data.test.ts fails when it drifts or when a
 * declared text/surface pair misses its contrast minimum. Regenerate with
 * `UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test`.
 */
export const aiDataPrimitives = {
  ink950: "#0A0C0F",
  ink900: "#111418",
  ink800: "#1D2229",
  grey900: "#1B2027",
  grey700: "#3C444E",
  grey600: "#59636F",
  grey500: "#7C8794",
  grey300: "#B4BCC6",
  grey200: "#D8DDE3",
  grey100: "#EBEEF2",
  grey50: "#F4F6F8",
  white: "#FFFFFF",
  accent800: "#273D52",
  accent700: "#34506A",
  accent300: "#A9BED3",
  accent200: "#C9D6E3",
  accent100: "#E3EAF1",
  teal950: "#0D2423",
  teal300: "#5EC8BE",
  teal700: "#0F6A66",
  teal100: "#DDF2EF",
  ok700: "#1D6B45",
  ok100: "#E3F1E8",
  warn700: "#7F4E00",
  warn100: "#FAEFDB",
  error700: "#A3302A",
  error100: "#FAE6E4",
} as const;

export type AiDataPrimitive = keyof typeof aiDataPrimitives;
export type AiDataTone = "dark" | "light" | "muted";

export interface AiDataRoles {
  /** Band background. */
  readonly bg: AiDataPrimitive;
  /** Raised panel inside the band (cards, the form). */
  readonly surface: AiDataPrimitive;
  /** Body copy. */
  readonly text: AiDataPrimitive;
  readonly heading: AiDataPrimitive;
  /** Secondary copy and metadata. */
  readonly muted: AiDataPrimitive;
  /** Fine rules and grid lines (decorative). */
  readonly border: AiDataPrimitive;
  /** Diagram strokes and rules that carry meaning: 3:1 against the band. */
  readonly line: AiDataPrimitive;
  /** Form control boundary: 3:1 against the band and the control fill (WCAG 1.4.11). */
  readonly controlBorder: AiDataPrimitive;
  readonly controlBg: AiDataPrimitive;
  readonly action: AiDataPrimitive;
  readonly actionHover: AiDataPrimitive;
  readonly actionText: AiDataPrimitive;
  readonly link: AiDataPrimitive;
  readonly linkHover: AiDataPrimitive;
  readonly focus: AiDataPrimitive;
  /** The blue-grey accent, text and UI use. */
  readonly accent: AiDataPrimitive;
  readonly eyebrow: AiDataPrimitive;
  /**
   * Teal signal: the active step, the selected item and the "this is the result" marker in work
   * surfaces. Text and UI use on `bg` and `surface` (4.5:1).
   */
  readonly signal: AiDataPrimitive;
  /** Tint behind a selected or highlighted row; `text` and `signal` stay legible on it. */
  readonly signalSoft: AiDataPrimitive;
  /** Small label chip ("Synthetic data") and the text on it. */
  readonly chipBg: AiDataPrimitive;
  readonly chipText: AiDataPrimitive;
}

export const aiDataTones = {
  dark: {
    bg: "ink950",
    surface: "ink900",
    text: "grey200",
    heading: "white",
    muted: "grey300",
    border: "ink800",
    line: "grey500",
    controlBorder: "grey500",
    controlBg: "ink900",
    action: "white",
    actionHover: "grey200",
    actionText: "ink950",
    link: "white",
    linkHover: "accent200",
    focus: "accent300",
    accent: "accent300",
    eyebrow: "accent300",
    signal: "teal300",
    signalSoft: "teal950",
    chipBg: "ink800",
    chipText: "grey200",
  },
  light: {
    bg: "white",
    surface: "grey50",
    text: "grey900",
    heading: "ink950",
    muted: "grey600",
    border: "grey200",
    line: "grey600",
    controlBorder: "grey600",
    controlBg: "white",
    action: "accent700",
    actionHover: "accent800",
    actionText: "white",
    link: "accent700",
    linkHover: "accent800",
    focus: "accent700",
    accent: "accent700",
    eyebrow: "accent700",
    signal: "teal700",
    signalSoft: "teal100",
    chipBg: "accent100",
    chipText: "accent800",
  },
  muted: {
    bg: "grey50",
    surface: "white",
    text: "grey900",
    heading: "ink950",
    muted: "grey600",
    border: "grey200",
    line: "grey600",
    controlBorder: "grey600",
    controlBg: "white",
    action: "accent700",
    actionHover: "accent800",
    actionText: "white",
    link: "accent700",
    linkHover: "accent800",
    focus: "accent700",
    accent: "accent700",
    eyebrow: "accent700",
    signal: "teal700",
    signalSoft: "teal100",
    chipBg: "accent100",
    chipText: "accent800",
  },
} as const satisfies Record<AiDataTone, AiDataRoles>;

/** Reconciliation statuses on the demonstrator page: text on its tint, always with a label. */
export const aiDataStatus = {
  ok: { fg: "ok700", bg: "ok100" },
  warn: { fg: "warn700", bg: "warn100" },
  error: { fg: "error700", bg: "error100" },
  info: { fg: "accent800", bg: "accent100" },
} as const satisfies Record<string, { fg: AiDataPrimitive; bg: AiDataPrimitive }>;

/** The site's `--tone-*` roles each AI & Data role stands in for inside a band. */
const toneBridge: Record<string, keyof AiDataRoles> = {
  bg: "bg",
  text: "text",
  heading: "heading",
  muted: "muted",
  border: "border",
  "control-border": "controlBorder",
  "control-bg": "controlBg",
  action: "action",
  "action-hover": "actionHover",
  "action-text": "actionText",
  link: "link",
  "link-hover": "linkHover",
  focus: "focus",
  accent: "accent",
  eyebrow: "eyebrow",
  "tile-bg": "chipBg",
  "tile-fg": "accent",
};

const kebab = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-z])([0-9])/g, "$1-$2")
    .toLowerCase();

export interface AiDataContrastPair {
  readonly name: string;
  readonly fg: string;
  readonly bg: string;
  /** 7 for body text (AAA), 4.5 for other text (AA), 3 for UI boundaries and focus. */
  readonly min: number;
}

/** Every foreground and surface pair the AI & Data pages use. ai-data.test.ts asserts each one. */
export function aiDataContrastPairs(): AiDataContrastPair[] {
  const hex = (token: AiDataPrimitive) => aiDataPrimitives[token];
  const pairs: AiDataContrastPair[] = [];
  for (const tone of Object.keys(aiDataTones) as AiDataTone[]) {
    const t: AiDataRoles = aiDataTones[tone];
    for (const [surfaceName, surface] of [
      ["bg", t.bg],
      ["surface", t.surface],
    ] as const) {
      const add = (role: string, fg: AiDataPrimitive, min: number) =>
        pairs.push({ name: `${tone}/${surfaceName}/${role}`, fg: hex(fg), bg: hex(surface), min });
      add("text", t.text, 7);
      add("heading", t.heading, 7);
      add("muted", t.muted, 4.5);
      add("link", t.link, 4.5);
      add("linkHover", t.linkHover, 4.5);
      add("accent", t.accent, 4.5);
      add("eyebrow", t.eyebrow, 4.5);
      add("signal", t.signal, 4.5);
      add("line", t.line, 3);
      add("controlBorder", t.controlBorder, 3);
      add("focus", t.focus, 3);
      add("actionFillBoundary", t.action, 3);
    }
    const add = (role: string, fg: AiDataPrimitive, bg: AiDataPrimitive, min: number) =>
      pairs.push({ name: `${tone}/${role}`, fg: hex(fg), bg: hex(bg), min });
    add("controlText", t.text, t.controlBg, 7);
    add("controlBorderOnControl", t.controlBorder, t.controlBg, 3);
    add("actionLabel", t.actionText, t.action, 4.5);
    add("actionHoverLabel", t.actionText, t.actionHover, 4.5);
    add("chip", t.chipText, t.chipBg, 4.5);
    add("textOnSignalSoft", t.text, t.signalSoft, 7);
    add("headingOnSignalSoft", t.heading, t.signalSoft, 7);
    add("signalOnSignalSoft", t.signal, t.signalSoft, 4.5);
  }
  for (const [name, { fg, bg }] of Object.entries(aiDataStatus)) {
    pairs.push({ name: `status/${name}`, fg: hex(fg), bg: hex(bg), min: 4.5 });
    // The status label also sits directly on light and muted bands.
    pairs.push({ name: `status/${name}/on-white`, fg: hex(fg), bg: hex("white"), min: 4.5 });
    pairs.push({ name: `status/${name}/on-grey50`, fg: hex(fg), bg: hex("grey50"), min: 4.5 });
  }
  return pairs;
}

export function renderAiDataCss(): string {
  const primitives = (Object.keys(aiDataPrimitives) as AiDataPrimitive[])
    .map((k) => `  --aid-${kebab(k)}: ${aiDataPrimitives[k].toLowerCase()};`)
    .join("\n");
  const roleNames = Object.keys(aiDataTones.light) as (keyof AiDataRoles)[];
  const scope = (tone: AiDataTone) => {
    const t: AiDataRoles = aiDataTones[tone];
    return [
      `[data-aid-tone="${tone}"] {`,
      ...roleNames.map((role) => `  --aid-${kebab(role)}: var(--aid-${kebab(t[role])});`),
      ...Object.entries(toneBridge).map(
        ([toneRole, role]) => `  --tone-${toneRole}: var(--aid-${kebab(role)});`,
      ),
      "  background-color: var(--aid-bg);",
      "  color: var(--aid-text);",
      "}",
    ].join("\n");
  };
  const theme = [
    ...roleNames.map((role) => `  --color-aid-${kebab(role)}: var(--aid-${kebab(role)});`),
    ...Object.entries(aiDataStatus).flatMap(([name, { fg, bg }]) => [
      `  --color-aid-${name}: var(--aid-${kebab(fg)});`,
      `  --color-aid-${name}-bg: var(--aid-${kebab(bg)});`,
    ]),
  ].join("\n");
  return [
    "/* Generated from src/ai-data.ts. Do not edit by hand. Vitalos AI & Data token scope. */",
    "",
    ":root {",
    primitives,
    "}",
    "",
    ...(["dark", "light", "muted"] as const).flatMap((tone) => [scope(tone), ""]),
    "/* Tailwind theme mapping: utilities such as bg-aid-bg resolve against the nearest band. */",
    "@theme inline {",
    theme,
    "}",
    "",
  ].join("\n");
}
