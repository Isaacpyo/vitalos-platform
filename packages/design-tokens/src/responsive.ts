/**
 * Responsive tokens (Stage 9 sections 5, 6 and 7): container width, gutters and section rhythm.
 * Values are px and become fluid clamp() expressions in the generated CSS.
 */
export const responsive = {
  container: {
    /** Broad compositions (Stage 9 section 6: about 1440px). */
    max: 1440,
    /** Text-rich content sits well inside the canvas. */
    content: 1120,
    /** Reading measure for long-form prose (60 to 75 characters). */
    prose: 720,
    /** Fluid gutter: 16px at a 320px viewport, 48px from the xl breakpoint. */
    gutterMin: 16,
    gutterMax: 48,
  },
  /** Section vertical padding [mobile, desktop] px; desktop 96 to 128, mobile 56 to 80. */
  sectionSpacing: {
    compact: [48, 64],
    default: [56, 96],
    large: [80, 128],
  },
  /** Viewport widths (px) between which fluid values interpolate. */
  fluid: { from: 320, to: 1280 },
} as const;

export type SectionSpacing = keyof typeof responsive.sectionSpacing;
