/**
 * Shared class strings for the Base UI based overlay primitives. Colours come only from the
 * `--tone-*` roles. Overlays render in a portal outside the band that opened them, so they carry
 * no tone of their own: pass the page's tone attribute (for AI & Data, `data-aid-tone="dark"`)
 * on the content component and it is spread onto the popup element.
 */
export const popupSurface =
  "bg-tone-control-bg text-tone-text border border-tone-border rounded-lg shadow-floating outline-none";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus";

/** Transition for popups: scale and fade of the chrome only; text is never faded in page content. */
export const popupMotion =
  "transition-[opacity,scale] duration-(--duration-reveal) ease-(--ease-standard) " +
  "data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0";

export const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-transparent text-tone-muted " +
  "transition-colors duration-(--duration-feedback) hover:border-tone-border hover:text-tone-heading " +
  "active:translate-y-px " +
  focusRing;
