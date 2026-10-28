/**
 * Vitalos Relay token scope: the brand v2 values from docs/relay/reference/brand/tokens.json
 * (design system v2, 10 October 2026), for the Relay launcher and panel only.
 *
 * The site's own tokens (./primitives.ts) are locked (ADR-008, ADR-016) and differ from brand v2;
 * Relay does not change them (docs/relay/DECISIONS.md 11, owner decision open). Components use
 * the semantic `--relay-*` roles; foundation colours appear only on fixed brand grounds (panel
 * header, visitor messages, launcher, nodes).
 *
 * relay.css is generated from this file; relay.test.ts fails when it drifts. Regenerate with
 * `UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test`.
 */
export const relayFoundation = {
  midnight: "#0B1320",
  midnight800: "#111B2E",
  midnight700: "#1A2740",
  cobalt: "#2F6BFF",
  cobalt600: "#2458E6",
  cobalt300: "#7FA3FF",
  mineral: "#18B7A0",
  mineral700: "#0E7C6B",
  mineral300: "#3FD0BA",
  offWhite: "#F5F7FA",
  white: "#FFFFFF",
  slate600: "#4A5568",
  slate300: "#A7B2C4",
  lineLight: "#D5DCE6",
  lineDark: "#26344D",
  strokeLight: "#7A879B",
  strokeDark: "#5F6E86",
} as const;

type Foundation = keyof typeof relayFoundation;

/** Semantic roles, light and dark (tokens.json). */
export const relaySemantic: Record<string, { light: Foundation; dark: Foundation }> = {
  surface100: { light: "offWhite", dark: "midnight" },
  surface200: { light: "white", dark: "midnight800" },
  surfaceInverse: { light: "midnight", dark: "offWhite" },
  ink: { light: "midnight", dark: "offWhite" },
  inkMuted: { light: "slate600", dark: "slate300" },
  inkInverse: { light: "offWhite", dark: "midnight" },
  action: { light: "cobalt600", dark: "cobalt300" },
  onAction: { light: "white", dark: "midnight" },
  accentText: { light: "cobalt600", dark: "cobalt300" },
  mineralText: { light: "mineral700", dark: "mineral300" },
  line: { light: "lineLight", dark: "lineDark" },
  lineStrong: { light: "strokeLight", dark: "strokeDark" },
  focusRing: { light: "cobalt600", dark: "cobalt300" },
};

/** The only transparency the brand allows: the tablet drawer scrim (midnight at 40%). */
export const relayScrim = "rgba(11, 19, 32, 0.4)";

/** Elevation for the floating panel and its cards (midnight-tinted shadows, unchanged values moved here from panel.css). */
export const relayShadows = {
  panel: "0 24px 48px -12px rgb(11 19 32 / 0.28)",
  card: "0 12px 24px -8px rgb(11 19 32 / 0.2)",
} as const;

const kebab = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-z])([0-9])/g, "$1-$2")
    .toLowerCase();

export function renderRelayCss(): string {
  const foundation = (Object.keys(relayFoundation) as Foundation[])
    .map((k) => `  --relay-${kebab(k)}: ${relayFoundation[k].toLowerCase()};`)
    .join("\n");
  const roles = (theme: "light" | "dark") =>
    Object.entries(relaySemantic)
      .map(([k, v]) => `  --relay-${kebab(k)}: var(--relay-${kebab(v[theme])});`)
      .join("\n");
  return [
    "/* Generated from src/relay.ts. Do not edit by hand. Brand v2 scope for Vitalos Relay. */",
    "",
    ".relay-root {",
    foundation,
    `  --relay-scrim: ${relayScrim};`,
    `  --relay-shadow-panel: ${relayShadows.panel};`,
    `  --relay-shadow-card: ${relayShadows.card};`,
    roles("light"),
    "}",
    "",
    '/* The site has no dark theme today; these apply if one is added under [data-theme="dark"]. */',
    '[data-theme="dark"] .relay-root {',
    roles("dark"),
    "}",
    "",
  ].join("\n");
}
