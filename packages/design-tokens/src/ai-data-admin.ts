import { aiDataPrimitives, aiDataStatus, aiDataTones, type AiDataRoles } from "./ai-data";
import { durations, easing, elevation, radii, space } from "./primitives";

/**
 * Super Admin scope of the AI & Data tokens (ADR-055). The marketing section at /ai-data and the
 * admin workspace at admin.vitalos.co.uk/ai-data share one source: ./ai-data.ts (colour roles) and
 * ./primitives.ts (spacing, radii, shadow, motion). This module only maps them onto the admin's
 * theme switch (`<html data-theme="light|dark|system">`) and adds denser spacing for operational
 * work. Light uses the "light" tone, dark uses the "dark" tone.
 *
 * `renderAdminAiDataCss()` is written to superadmin/assets/ai-data-tokens.css by
 * ai-data-admin.test.ts (`UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test`), and
 * the same test fails when the committed file drifts. Tailwind imports it, so `bg-aid-surface`,
 * `text-aid-muted`, `border-aid-border`, `text-aid-warn` and friends are available in admin templates.
 */

/** Dark-surface status pairs (the marketing statuses are defined for light surfaces only). */
export const adminDarkStatus = {
  ok: { fg: "#8FD4AE", bg: "#12281C" },
  warn: { fg: "#E9C37A", bg: "#2E2209" },
  error: { fg: "#F0A39D", bg: "#35100D" },
  info: { fg: "#C9D6E3", bg: "#1D2229" },
} as const;

export interface AdminContrastPair {
  readonly name: string;
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
}

const kebab = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-z])([0-9])/g, "$1-$2")
    .toLowerCase();

const roleNames = Object.keys(aiDataTones.light) as (keyof AiDataRoles)[];

/** Foreground and surface pairs the admin workspace uses, for the contrast test. */
export function adminContrastPairs(): AdminContrastPair[] {
  const pairs: AdminContrastPair[] = [];
  for (const mode of ["light", "dark"] as const) {
    const tone: AiDataRoles = aiDataTones[mode];
    const hex = (key: keyof typeof aiDataPrimitives) => aiDataPrimitives[key];
    for (const [surfaceName, surface] of [
      ["bg", tone.bg],
      ["surface", tone.surface],
    ] as const) {
      pairs.push({ name: `${mode}/${surfaceName}/text`, fg: hex(tone.text), bg: hex(surface), min: 7 });
      pairs.push({
        name: `${mode}/${surfaceName}/muted`,
        fg: hex(tone.muted),
        bg: hex(surface),
        min: 4.5,
      });
      pairs.push({ name: `${mode}/${surfaceName}/link`, fg: hex(tone.link), bg: hex(surface), min: 4.5 });
      pairs.push({ name: `${mode}/${surfaceName}/focus`, fg: hex(tone.focus), bg: hex(surface), min: 3 });
    }
  }
  for (const [name, pair] of Object.entries(aiDataStatus)) {
    pairs.push({
      name: `light/status/${name}`,
      fg: aiDataPrimitives[pair.fg],
      bg: aiDataPrimitives[pair.bg],
      min: 4.5,
    });
  }
  for (const [name, pair] of Object.entries(adminDarkStatus)) {
    pairs.push({ name: `dark/status/${name}`, fg: pair.fg, bg: pair.bg, min: 4.5 });
  }
  return pairs;
}

export function renderAdminAiDataCss(): string {
  const primitives = (Object.keys(aiDataPrimitives) as (keyof typeof aiDataPrimitives)[])
    .map((k) => `  --aid-${kebab(k)}: ${aiDataPrimitives[k].toLowerCase()};`)
    .join("\n");
  const scale = Object.entries(space)
    .filter(([step]) => Number(step) <= 6)
    .map(([step, px]) => `  --aid-space-${step}: ${px / 16}rem;`)
    .join("\n");
  const roles = (mode: "light" | "dark") =>
    roleNames
      .map((role) => `  --aid-${kebab(role)}: var(--aid-${kebab(aiDataTones[mode][role])});`)
      .join("\n");
  const status = (mode: "light" | "dark") =>
    Object.entries(aiDataStatus)
      .flatMap(([name, { fg, bg }]) => {
        if (mode === "light") {
          return [
            `  --aid-${name}: var(--aid-${kebab(fg)});`,
            `  --aid-${name}-bg: var(--aid-${kebab(bg)});`,
          ];
        }
        const dark = adminDarkStatus[name as keyof typeof adminDarkStatus];
        return [
          `  --aid-${name}: ${dark.fg.toLowerCase()};`,
          `  --aid-${name}-bg: ${dark.bg.toLowerCase()};`,
        ];
      })
      .join("\n");
  const mapping = [
    ...roleNames.map((role) => `  --color-aid-${kebab(role)}: var(--aid-${kebab(role)});`),
    ...Object.keys(aiDataStatus).flatMap((name) => [
      `  --color-aid-${name}: var(--aid-${name});`,
      `  --color-aid-${name}-bg: var(--aid-${name}-bg);`,
    ]),
  ].join("\n");
  const dark = `${roles("dark")}\n${status("dark")}`;
  return [
    "/* Generated from packages/design-tokens/src/ai-data-admin.ts. Do not edit by hand. */",
    "/* Super Admin scope of the Vitalos AI & Data tokens (ADR-055). */",
    "",
    ":root {",
    primitives,
    scale,
    "  /* Operational density: tighter than the marketing scale. */",
    "  --aid-density-gap: 0.5rem;",
    "  --aid-density-pad: 0.75rem;",
    "  --aid-density-row: 2.25rem;",
    `  --aid-radius-sm: ${radii.sm}px;`,
    `  --aid-radius-md: ${radii.md}px;`,
    `  --aid-radius-lg: ${radii.lg}px;`,
    `  --aid-shadow-floating: ${elevation.floating};`,
    `  --aid-motion-feedback: ${durations.feedback}ms;`,
    `  --aid-motion-reveal: ${durations.reveal}ms;`,
    `  --aid-ease: ${easing.standard};`,
    "}",
    "",
    "[data-aid-admin] {",
    roles("light"),
    status("light"),
    "}",
    "",
    ':root[data-theme="dark"] [data-aid-admin] {',
    dark,
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    '  :root[data-theme="system"] [data-aid-admin] {',
    dark,
    "  }",
    "}",
    "",
    "/* Tailwind theme mapping: bg-aid-surface, text-aid-muted, border-aid-border, text-aid-warn... */",
    "@theme inline {",
    mapping,
    "}",
    "",
  ].join("\n");
}
