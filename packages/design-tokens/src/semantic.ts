/**
 * Semantic tokens (Stage 9 section 33): meaning, not value. Each tone maps roles such as
 * "heading" or "action" onto primitive colour tokens. Components read the CSS variables generated
 * from these maps (`--tone-*`), scoped by `data-tone="light|muted|dark"`, so a dark Section
 * switches every descendant to verified contrast pairs without per-component overrides.
 */
import { colors, type ColorToken } from "./primitives";

export type Tone = "light" | "muted" | "dark";

export interface ToneRoles {
  /** Page or section background. */
  readonly bg: ColorToken;
  /** Default body copy. */
  readonly text: ColorToken;
  /** Headings and high-emphasis copy. */
  readonly heading: ColorToken;
  /** Secondary copy and metadata. */
  readonly muted: ColorToken;
  /** Structural rules and dividers (decorative, not a control boundary). */
  readonly border: ColorToken;
  /** Form control boundary; must reach 3:1 against the surface (WCAG 1.4.11). */
  readonly controlBorder: ColorToken;
  /** Form control fill. */
  readonly controlBg: ColorToken;
  /** Primary action fill. */
  readonly action: ColorToken;
  readonly actionHover: ColorToken;
  /** Label colour on the action fill. */
  readonly actionText: ColorToken;
  /** Inline link colour. */
  readonly link: ColorToken;
  readonly linkHover: ColorToken;
  /** Keyboard focus indicator. */
  readonly focus: ColorToken;
  /** Rare data/intelligence accent, text and UI use. */
  readonly accent: ColorToken;
}

export const tones = {
  light: {
    bg: "white",
    text: "slate900",
    heading: "midnight950",
    muted: "slate700",
    border: "border",
    controlBorder: "slate700",
    controlBg: "white",
    action: "blue600",
    actionHover: "blue700",
    actionText: "white",
    link: "blue600",
    linkHover: "blue700",
    focus: "blue600",
    accent: "aqua600",
  },
  muted: {
    bg: "cloud50",
    text: "slate900",
    heading: "midnight950",
    muted: "slate700",
    border: "border",
    controlBorder: "slate700",
    controlBg: "white",
    action: "blue600",
    actionHover: "blue700",
    actionText: "white",
    link: "blue600",
    linkHover: "blue700",
    focus: "blue600",
    accent: "aqua600",
  },
  dark: {
    bg: "midnight950",
    text: "cloud50",
    heading: "white",
    muted: "border",
    border: "midnight800",
    controlBorder: "border",
    controlBg: "midnight800",
    // Blue on midnight is only about 3.3:1, so the dark-surface primary is a light fill with
    // midnight text (Stage 9 section 14, "dark-surface primary"), verified in contrast.test.ts.
    action: "white",
    actionHover: "border",
    actionText: "midnight950",
    link: "white",
    linkHover: "border",
    focus: "white",
    accent: "white",
  },
} as const satisfies Record<Tone, ToneRoles>;

/** Status colours. Colour never communicates status alone: pair with an icon and a text label. */
export const status = {
  success: "success",
  warning: "warning",
  danger: "danger",
} as const satisfies Record<string, ColorToken>;

export type ToneRoleName = keyof ToneRoles;

export type ContrastKind = "text" | "ui";

export interface ContrastPair {
  readonly name: string;
  readonly fg: string;
  readonly bg: string;
  readonly kind: ContrastKind;
  /** Required minimum ratio: 4.5 body text, 3 for large text and non-text UI. */
  readonly min: number;
}

const hex = (token: ColorToken): string => colors[token];

/**
 * Every declared foreground and surface pair that carries meaning. contrast.test.ts asserts each
 * one. Blue-on-midnight is deliberately absent because it only reaches about 3.3:1; it may be used
 * for non-text decoration and large text only, never for body text.
 */
export function declaredContrastPairs(): ContrastPair[] {
  const pairs: ContrastPair[] = [];
  const toneNames = Object.keys(tones) as Tone[];
  for (const tone of toneNames) {
    const t = tones[tone];
    const surface = hex(t.bg);
    const add = (
      role: string,
      fg: ColorToken,
      bg: string,
      kind: ContrastKind,
      min: number,
    ): void => {
      pairs.push({ name: `${tone}/${role}`, fg: hex(fg), bg, kind, min });
    };
    add("text", t.text, surface, "text", 4.5);
    add("heading", t.heading, surface, "text", 4.5);
    add("muted", t.muted, surface, "text", 4.5);
    add("link", t.link, surface, "text", 4.5);
    add("linkHover", t.linkHover, surface, "text", 4.5);
    add("accent", t.accent, surface, "text", 4.5);
    add("focus", t.focus, surface, "ui", 3);
    add("controlBorder", t.controlBorder, surface, "ui", 3);
    add("controlBorderOnControl", t.controlBorder, hex(t.controlBg), "ui", 3);
    add("controlText", t.text, hex(t.controlBg), "text", 4.5);
    add("actionLabel", t.actionText, hex(t.action), "text", 4.5);
    add("actionHoverLabel", t.actionText, hex(t.actionHover), "text", 4.5);
    add("actionFillBoundary", t.action, surface, "ui", 3);
    for (const [name, token] of Object.entries(status) as [string, ColorToken][]) {
      // Status text appears on light and muted surfaces; dark surfaces do not carry status text.
      if (tone !== "dark") add(`status-${name}`, token, surface, "text", 4.5);
    }
  }
  return pairs;
}
