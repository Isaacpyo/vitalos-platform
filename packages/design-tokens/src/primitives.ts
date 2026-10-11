/**
 * Primitive design tokens (Stage 9 sections 4 to 8 and 11). Raw values live here and nowhere else:
 * no hex or rgb() value may appear outside this package (tooling/scripts/check-raw-colours.mjs).
 * Components consume semantic tokens (./semantic.ts) or the generated CSS variables, never these
 * directly.
 */

/**
 * Brand colours, exact values from Stage 9 section 4.
 *
 * `blue600` keeps #2457FF (the strategy-locked Vitalos Blue). The approved Figma board labels its
 * primary Cobalt #2F6BFF; the owner has not yet chosen between them, see
 * docs/brand/token-reconciliation.md. Changing this single value re-themes everything.
 */
export const colors = {
  midnight950: "#081A2A",
  midnight800: "#173247",
  blue600: "#2457FF",
  blue700: "#1746DB",
  aqua600: "#007E76",
  cloud50: "#F7F9FC",
  white: "#FFFFFF",
  slate700: "#536273",
  slate900: "#26333F",
  border: "#D9E1E8",
  success: "#18794E",
  warning: "#9A6700",
  danger: "#C9372C",
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Tints of the locked hues (ADR-023, web presentation from the owner comp). They are not new
 * hues: each is a light mix of Vitalos Blue or Aqua with white, used for icon tiles and for
 * decorative, non-text surfaces (hero planes, media placeholders). Kept apart from `colors` so
 * the Stage 9 section 4 set stays exact. PENDING DESIGN REVIEW (ADR-008).
 */
export const tints = {
  blue50: "#EEF2FF",
  blue100: "#DCE4FF",
  aqua50: "#E6F4F2",
} as const;

export type TintToken = keyof typeof tints;

/** Every colour token: the Stage 9 colours plus the tints. Tone roles and the CSS read this. */
export const palette = { ...colors, ...tints } as const;

export type PaletteToken = keyof typeof palette;

/** 4px base spacing scale (Stage 9 section 7), in px. space-1 to space-10. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
  9: 96,
  10: 128,
} as const;

export type SpaceToken = keyof typeof space;

/** Breakpoint minimum widths in px (Stage 9 section 6). xs starts at 0. */
export const breakpoints = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/** Corner radii in px (Stage 9 section 8: small default, 4 to 8px). */
export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  /** Selected media only (Stage 9 section 8), for example the hero visual panels. */
  xl: 12,
} as const;

/** Motion durations in ms (Stage 9 section 11). */
export const durations = {
  /** Hover and focus feedback, 100 to 180ms. */
  feedback: 140,
  /** Menu and panel reveal, 160 to 240ms. */
  reveal: 200,
  /** Accordion and disclosure, 180 to 260ms. */
  disclosure: 220,
  /** Optional section entrance, 200 to 400ms. */
  entrance: 400,
  /** Diagram sequence, 400 to 800ms. */
  diagram: 600,
} as const;

export const easing = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  /** Decelerating curve for entrances and the arrow slide (the owner comp's motion feel). */
  emphasis: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/**
 * Type roles (Stage 9 section 5). Sizes are px at the mobile floor and the desktop ceiling taken
 * from the spec ranges; the CSS layer interpolates fluidly between the sm and xl breakpoints.
 * Line heights are unitless.
 */
export interface TypeRole {
  readonly mobile: number;
  readonly desktop: number;
  readonly lineHeight: number;
  readonly weight: number;
  /** Letter spacing in em. */
  readonly tracking: number;
  readonly uppercase?: boolean;
}

export const typeRoles = {
  displayXl: { mobile: 44, desktop: 72, lineHeight: 1, weight: 600, tracking: -0.03 },
  displayL: { mobile: 40, desktop: 60, lineHeight: 1.02, weight: 600, tracking: -0.025 },
  h1: { mobile: 36, desktop: 48, lineHeight: 1.1, weight: 600, tracking: -0.02 },
  h2: { mobile: 30, desktop: 40, lineHeight: 1.08, weight: 600, tracking: -0.02 },
  h3: { mobile: 22, desktop: 26, lineHeight: 1.25, weight: 600, tracking: -0.005 },
  bodyL: { mobile: 18, desktop: 20, lineHeight: 1.5, weight: 400, tracking: 0 },
  body: { mobile: 16, desktop: 17, lineHeight: 1.55, weight: 400, tracking: 0 },
  small: { mobile: 13, desktop: 14, lineHeight: 1.5, weight: 400, tracking: 0 },
  eyebrow: {
    mobile: 12,
    desktop: 13,
    lineHeight: 1.4,
    weight: 600,
    tracking: 0.14,
    uppercase: true,
  },
} as const satisfies Record<string, TypeRole>;

export type TypeRoleName = keyof typeof typeRoles;

/**
 * Provisional font stacks (Stage 7 section 15.1: Geist Sans + Source Serif 4 + Geist Mono, subject
 * to licensing and rendering validation). PENDING OWNER CONFIRMATION, see
 * docs/brand/token-reconciliation.md. Each stack first reads the CSS variable that next/font sets
 * in the web app, then the plain family name (Storybook @font-face), then system fallbacks.
 */
export const fonts = {
  sans: 'var(--font-geist-sans, "Geist"), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Aptos, sans-serif',
  serif:
    'var(--font-source-serif, "Source Serif 4"), ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: 'var(--font-geist-mono, "Geist Mono"), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

/** Box shadow used only by floating surfaces such as menus and dialogs (Stage 9 section 8). */
export const elevation = {
  floating: "0 8px 24px 0 rgb(8 26 42 / 0.12)",
} as const;
