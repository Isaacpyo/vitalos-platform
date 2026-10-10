/**
 * Component tokens (Stage 9 section 33): sizing decisions that belong to a component contract,
 * in px. Components consume these through the generated `--size-*` CSS variables and Tailwind
 * theme, not arbitrary values.
 */
export const component = {
  button: {
    /** Minimum block sizes. md and lg meet a 44px touch target; sm is for dense rows only. */
    heightSm: 40,
    heightMd: 48,
    heightLg: 56,
    paddingXSm: 16,
    paddingXMd: 24,
    paddingXLg: 32,
  },
  control: {
    /** Form control minimum height (text input, select). */
    height: 48,
    borderWidth: 1,
  },
  header: {
    height: 72,
  },
  focus: {
    outlineWidth: 3,
    outlineOffset: 3,
  },
} as const;
