/**
 * Renders theme.css and tailwind-theme.css from the TypeScript tokens so the three can never
 * drift. css.test.ts fails when the committed files differ from this output; regenerate with
 * `UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test`.
 */
import { component } from "./component";
import {
  breakpoints,
  durations,
  easing,
  elevation,
  fonts,
  palette,
  radii,
  space,
  typeRoles,
  type PaletteToken,
} from "./primitives";
import { responsive } from "./responsive";
import { tones, type Tone, type ToneRoleName } from "./semantic";

const HEADER = "/* Generated from src/*.ts by src/css.ts. Do not edit by hand. */\n";

const round = (n: number): string => String(Math.round(n * 10000) / 10000);
const rem = (px: number): string => `${round(px / 16)}rem`;

/** kebab-case a camelCase token key, splitting digits: midnight950 -> midnight-950, displayXl -> display-xl, h1 -> h1. */
export function kebab(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-z]{2,})([0-9])/g, "$1-$2")
    .toLowerCase();
}

/** Fluid value between two px sizes across the responsive.fluid viewport range, as a clamp(). */
export function fluid(minPx: number, maxPx: number): string {
  if (minPx === maxPx) return rem(minPx);
  const { from, to } = responsive.fluid;
  const slope = (maxPx - minPx) / (to - from); // px per viewport px
  const base = minPx - slope * from; // px at 0 viewport
  return `clamp(${rem(minPx)}, calc(${rem(base)} + ${round(slope * 100)}vw), ${rem(maxPx)})`;
}

const toneVar = (role: ToneRoleName): string => `--tone-${kebab(role)}`;
const colorVar = (token: PaletteToken): string => `--color-${kebab(token)}`;

function toneBlock(selector: string, tone: Tone): string {
  const roles = tones[tone];
  const lines = (Object.keys(roles) as ToneRoleName[]).map(
    (role) => `  ${toneVar(role)}: var(${colorVar(roles[role])});`,
  );
  return `${selector} {\n${lines.join("\n")}\n}\n`;
}

export function renderThemeCss(): string {
  const root: string[] = [];
  for (const [key, value] of Object.entries(palette)) {
    root.push(`  ${colorVar(key as PaletteToken)}: ${value};`);
  }
  for (const [key, px] of Object.entries(space)) root.push(`  --space-${key}: ${rem(px)};`);
  for (const [key, px] of Object.entries(radii)) root.push(`  --radius-${key}: ${rem(px)};`);
  for (const [key, ms] of Object.entries(durations)) {
    root.push(`  --duration-${kebab(key)}: ${ms}ms;`);
  }
  for (const [key, curve] of Object.entries(easing)) root.push(`  --ease-${kebab(key)}: ${curve};`);
  root.push(`  --shadow-floating: ${elevation.floating};`);
  root.push(`  --font-sans: ${fonts.sans};`);
  root.push(`  --font-serif: ${fonts.serif};`);
  root.push(`  --font-mono: ${fonts.mono};`);
  for (const [name, role] of Object.entries(typeRoles)) {
    const k = kebab(name);
    root.push(`  --text-${k}: ${fluid(role.mobile, role.desktop)};`);
    root.push(`  --text-${k}--line-height: ${role.lineHeight};`);
    root.push(`  --text-${k}--font-weight: ${role.weight};`);
    root.push(`  --text-${k}--letter-spacing: ${role.tracking}em;`);
  }
  const c = responsive.container;
  root.push(`  --container-max: ${rem(c.max)};`);
  root.push(`  --container-content: ${rem(c.content)};`);
  root.push(`  --container-prose: ${rem(c.prose)};`);
  root.push(`  --gutter: ${fluid(c.gutterMin, c.gutterMax)};`);
  for (const [key, [mobile, desktop]] of Object.entries(responsive.sectionSpacing)) {
    root.push(`  --section-${key}: ${fluid(mobile, desktop)};`);
  }
  const b = component.button;
  root.push(`  --size-button-sm: ${rem(b.heightSm)};`);
  root.push(`  --size-button-md: ${rem(b.heightMd)};`);
  root.push(`  --size-button-lg: ${rem(b.heightLg)};`);
  root.push(`  --size-control: ${rem(component.control.height)};`);
  root.push(`  --size-header: ${rem(component.header.height)};`);
  root.push(`  --size-header-condensed: ${rem(component.header.condensedHeight)};`);
  root.push(`  --focus-width: ${component.focus.outlineWidth}px;`);
  root.push(`  --focus-offset: ${component.focus.outlineOffset}px;`);

  return `${HEADER}
:root {
${root.join("\n")}
}

/* Tone scopes: Section sets data-tone; every descendant reads the --tone-* roles. */
${toneBlock(':root,\n[data-tone="light"]', "light")}
${toneBlock('[data-tone="muted"]', "muted")}
${toneBlock('[data-tone="dark"]', "dark")}
/* Focus: strong, consistent, never removed (Stage 9 section 30). */
:focus-visible {
  outline: var(--focus-width) solid var(--tone-focus);
  outline-offset: var(--focus-offset);
}

/* Reflow: long unbroken strings (URLs, identifiers) wrap instead of forcing horizontal scroll at 320px. */
html {
  overflow-wrap: anywhere;
}

/* Entrance keyframes for the decorative hero visual (ADR-023). Used only behind motion-safe. The
   panel carries text, so it only moves (never fades) and its contrast holds at every frame. */
@keyframes hero-plane {
  from {
    opacity: 0;
    translate: 0 1.5rem;
  }
}

/* Hero headline settle (ADR-024): each word is visible from the first frame and only rises a
   little into place (no opacity, no clip), so the largest text paints at once and stays legible. */
@keyframes hero-word {
  from {
    translate: 0 0.3em;
  }
}

/* Hero process card (owner decision 2026-10-12). Everything here is inside no-preference, so under
   reduced motion (or if CSS animation fails) the card simply renders in its final state: ticks
   drawn, last step blue, bars at full height. Transform, opacity and stroke-dashoffset only, so
   nothing shifts layout. Delays come from --d, set per element in HeroVisual. Every animation is
   finite (no infinite loops) so all motion ends within about 6s of load (WCAG 2.2.2). */
@keyframes hv-card {
  from {
    opacity: 0;
    translate: 0 0.5rem;
  }
}

@keyframes hv-dot {
  from {
    opacity: 0;
    scale: 0.6;
  }
}

@keyframes hv-tick {
  from {
    stroke-dashoffset: 1;
  }
}

/* Labels slide only: text is never drawn faint, so it is fully legible at every moment, with or
   without JavaScript (tests/end-to-end/motion.nojs.spec.ts). The checks carry the sequence. */
@keyframes hv-label {
  from {
    translate: -0.25rem 0;
  }
}

@keyframes hv-ring {
  from {
    opacity: 0.55;
    scale: 1;
  }
  to {
    opacity: 0;
    scale: 2.1;
  }
}

@keyframes hv-bar {
  from {
    scale: 1 0;
  }
}

@keyframes hv-wave {
  50% {
    scale: 1 0.78;
  }
}

@keyframes hv-flow {
  to {
    stroke-dashoffset: -16;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .hv-card {
    animation: hv-card var(--duration-diagram) var(--ease-emphasis) 240ms both;
  }
  .hv-dot {
    animation: hv-dot var(--duration-entrance) var(--ease-emphasis) var(--d) both;
  }
  .hv-tick {
    animation: hv-tick var(--duration-entrance) var(--ease-standard) var(--d) both;
  }
  .hv-label {
    animation: hv-label var(--duration-entrance) var(--ease-standard) var(--d) both;
  }
  .hv-ring {
    animation: hv-ring var(--duration-diagram) var(--ease-standard) var(--d) both;
  }
  .hv-bar {
    transform-origin: bottom;
    animation:
      hv-bar var(--duration-entrance) var(--ease-emphasis) var(--d) both,
      hv-wave 2500ms ease-in-out calc(var(--d) + 600ms + var(--w)) 1;
  }
  .hv-flow {
    animation: hv-flow 4s ease-out 240ms 1 both;
  }
}

/* Ambient hero motion (owner decision 2026-10-15): small, slow, looping movement on the homepage
   hero photograph and its glass panel. It is the one exception to the finite rule above, so it
   comes with a pause switch (WCAG 2.2.2): while a [data-motion-pause] checkbox inside a
   [data-motion-scope] is checked, every animation in that scope is held. Under reduced motion none
   of it runs and the switch is hidden. Transform, opacity and stroke-dashoffset only. */
@keyframes hv-drift {
  from {
    scale: 1.04;
    translate: 0 0;
  }
  to {
    scale: 1.12;
    translate: -2% -1%;
  }
}

@keyframes hv-float {
  50% {
    translate: 0 -0.375rem;
  }
}

@keyframes hv-glint {
  0%,
  100% {
    opacity: 0;
    scale: 0.4;
  }
  50% {
    opacity: 1;
    scale: 1;
  }
}

@keyframes hv-pulse {
  from {
    opacity: 0.6;
    scale: 1;
  }
  70%,
  to {
    opacity: 0;
    scale: 2.4;
  }
}

@keyframes hv-rail {
  from {
    scale: 1 0;
  }
}

@keyframes hv-stream {
  to {
    stroke-dashoffset: -32;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .hv-drift {
    animation: hv-drift 40s ease-in-out infinite alternate both;
  }
  .hv-float {
    animation: hv-float 7s ease-in-out 1.2s infinite;
  }
  .hv-glint {
    animation: hv-glint 4.8s ease-in-out var(--d, 0s) infinite both;
  }
  .hv-pulse {
    animation: hv-pulse 2.8s ease-out var(--d, 0s) infinite both;
  }
  .hv-rail {
    transform-origin: top;
    animation: hv-rail 1400ms var(--ease-standard) 600ms both;
  }
  .hv-stream {
    animation: hv-stream 3s linear infinite;
  }
  .hv-bar-idle {
    transform-origin: bottom;
    animation:
      hv-bar var(--duration-entrance) var(--ease-emphasis) var(--d) both,
      hv-wave 2600ms ease-in-out calc(var(--d) + 600ms + var(--w)) infinite;
  }
}

[data-motion-scope]:has([data-motion-pause]:checked) * {
  animation-play-state: paused !important;
}

label:has(> [data-motion-pause]:focus-visible) {
  outline: var(--focus-width) solid var(--tone-focus);
  outline-offset: var(--focus-offset);
}

/* Print and reduced motion (ADR-024): an entrance that has not run yet (content never scrolled
   to) or is mid-way must never clip or shift content on paper, nor once the visitor switches on
   reduced motion while the page is open. Overrides the inline styles the Reveal islands set. */
@media print, (prefers-reduced-motion: reduce) {
  [data-reveal-state],
  [data-reveal-item] {
    clip-path: none !important;
    transform: none !important;
  }
}

/* Reduced motion: keep state changes, drop transitions and smooth scrolling. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-feedback: 0.01ms;
    --duration-reveal: 0.01ms;
    --duration-disclosure: 0.01ms;
    --duration-entrance: 0.01ms;
    --duration-diagram: 0.01ms;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;
}

export function renderTailwindThemeCss(): string {
  // Literal (non-inline) theme values: identical to theme.css, but never self-referencing.
  const literal: string[] = [];
  for (const [key, value] of Object.entries(palette)) {
    literal.push(`  ${colorVar(key as PaletteToken)}: ${value};`);
  }
  literal.push(`  --font-sans: ${fonts.sans};`);
  literal.push(`  --font-serif: ${fonts.serif};`);
  literal.push(`  --font-mono: ${fonts.mono};`);
  for (const [key, px] of Object.entries(radii)) literal.push(`  --radius-${key}: ${rem(px)};`);
  literal.push(`  --shadow-floating: ${elevation.floating};`);
  for (const [key, curve] of Object.entries(easing)) {
    literal.push(`  --ease-${kebab(key)}: ${curve};`);
  }
  for (const [name, role] of Object.entries(typeRoles)) {
    const k = kebab(name);
    literal.push(`  --text-${k}: ${fluid(role.mobile, role.desktop)};`);
    literal.push(`  --text-${k}--line-height: ${role.lineHeight};`);
    literal.push(`  --text-${k}--font-weight: ${role.weight};`);
    literal.push(`  --text-${k}--letter-spacing: ${role.tracking}em;`);
  }
  for (const [key, px] of Object.entries(breakpoints)) {
    if (px > 0) literal.push(`  --breakpoint-${key}: ${rem(px)};`);
  }

  // Inline: utilities must resolve per element, so they keep the var() reference.
  const inline: string[] = [];
  inline.push("  /* Tone roles: bg-tone-bg, text-tone-heading, border-tone-border, ... */");
  for (const role of Object.keys(tones.light) as ToneRoleName[]) {
    inline.push(`  --color-tone-${kebab(role)}: var(${toneVar(role)});`);
  }

  return `${HEADER}
/*
 * Tailwind v4 theme mapping. \`--color-*: initial\` removes the default palette so only design
 * tokens exist as colour utilities. Values mirror theme.css (import both). The tone roles are
 * \`inline\` so utilities such as bg-tone-bg resolve against the nearest data-tone scope.
 */
@theme {
  --color-*: initial;
  --font-*: initial;
  --breakpoint-*: initial;
${literal.join("\n")}
}

@theme inline {
${inline.join("\n")}
}
`;
}
