# ADR 016 Styling, design tokens and typography

Status: Accepted. Refines ADR 008 (Figma and code token workflow); does not supersede it.

## Context

Stage 9 section 4 fixes the colour system and section 33 requires design tokens in four layers (primitive, semantic, component, responsive) with no hard-coded colours in page components. The Stage 1 baseline disagreed with the spec: aqua was `#45E0D0` (spec: aqua-600 `#007E76`), slate was `#425466` (spec slate-700 `#536273`), the border was `#CBD5DF` (spec `#D9E1E8`), blue-700, midnight-800, slate-900 and the status colours were missing, and raw hex lived in `packages/ui` and `apps/web/app/styles.css`. Tailwind v4 is the styling engine (Stage 0 section 7, Stage 10 section 4). Stage 7 section 15.1 recommends Geist Sans, Source Serif 4 and Geist Mono, subject to licensing and rendering validation. Final logo exports are not yet available.

## Decision

1. **`@vitalos/design-tokens` is the only place raw colour values exist.** The TypeScript modules are the source of truth: `primitives.ts` (colours with the exact Stage 9 section 4 values, `space` 1 to 10, breakpoints xs to 2xl, radii 4 to 8px, motion durations, type roles Display XL to Eyebrow, font stacks, elevation), `semantic.ts` (tones and status), `component.ts` (button, control, header and focus sizes) and `responsive.ts` (container, fluid gutter, section rhythm).
2. **CSS is generated, not hand-written.** `src/css.ts` renders `theme.css` (CSS custom properties, the three tone scopes, the global focus rule, reduced-motion and reflow rules) and `tailwind-theme.css` (a Tailwind v4 `@theme` mapping). `css.test.ts` fails if the committed files differ from the generated output; regenerate with `UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test`. Apps import both files; `tailwind-theme.css` resets the default palette (`--color-*: initial`) so only design tokens exist as colour utilities.
3. **Surfaces are tone scopes.** `Section` sets `data-tone="light|muted|dark"`; descendants read `--tone-*` roles (`bg`, `text`, `heading`, `muted`, `border`, `controlBorder`, `action`, `link`, `focus`, `accent`) through utilities such as `text-tone-heading`. A dark Section therefore switches every child to verified contrast pairs without per-component overrides. Components expose semantic variants (`Button` `variant`, `size`, `theme`; `Section` `tone`, `spacing`), never raw styling props.
4. **Contrast is a tested contract.** `contrast.test.ts` asserts WCAG 2.x ratios for every declared text and UI pair in every tone (4.5:1 text, 3:1 non-text). Brand blue on midnight is about 3.3:1 and aqua on midnight about 3.6:1, so neither is used for text on the dark surface; the dark-surface primary action is a white fill with midnight text, and dark focus rings are white. The decorative border colour (`#D9E1E8`, 1.3:1 on white) is never a form-control boundary; controls use slate-700 (6.3:1).
5. **No raw colours outside the token package.** `tooling/scripts/check-raw-colours.mjs` fails on hex, `rgb()`/`hsl()`/`oklch()` and Tailwind arbitrary colour values in `apps`, `packages`, `services`, `workers` and `tests` except under `packages/design-tokens`. Workstream F1 wires it into the root `check`.
6. **Typography is provisional.** Geist Sans, Geist Mono and Source Serif 4 are used as the Stage 7 section 15.1 starting set, pending owner confirmation and licensing and rendering validation. The font stacks read `--font-geist-sans`, `--font-geist-mono` and `--font-source-serif` first (set by `next/font` in the web app), then the plain family names (Storybook `@font-face`), then system fallbacks (Aptos on Windows Office installs), so a font swap changes tokens and loaders, not components. Storybook ships Geist through the existing `geist` dependency; Source Serif 4 is not bundled there (no dependency was added) and falls back to a system serif until the owner confirms the fonts. Type roles use fluid `clamp()` sizes between the spec's mobile and desktop values, in `rem`, so browser zoom scales them.
7. **Primitives live in `packages/ui/src/primitives`** as presentation-only components with plain `<a>` (no `next/link`, enforced by dependency-cruiser), visible focus from the global rule, native semantics first (`<details>`, `<dl>`, `<label>`), Testing Library tests for every interactive one, and Storybook stories with a11y set to `error`. `Stat` requires `source` and `Quote` requires `attribution`; without them they render nothing. `Wordmark` is a typed logo slot (`{ src, width, height }`) with the text fallback `VITALOS` until Figma exports are approved and delivered (`docs/brand/asset-approval.md`).

## Options

- Hand-maintained `theme.css` beside a TypeScript copy: rejected, the two drift; generation plus a sync test removes that class of defect.
- Tailwind default palette alongside the tokens: rejected, it makes off-system colours one class name away.
- CSS-in-JS or CSS modules in `packages/ui`: rejected, Tailwind v4 is already the platform decision and keeps the Storybook and web pipelines identical.
- Inline Tailwind theme values for tokens that share a name with a `:root` variable (`--color-blue-600: var(--color-blue-600)`): rejected, it emits self-referencing variables; literal mirrored values are used instead, with only the per-element tone roles kept `inline`.
- A runtime theme switcher: rejected for Stage 1; tone scopes cover light, muted and dark sections and there is no user-selectable theme requirement.

## Reasons

Stage 9 requires auditable, source-controlled tokens and verified contrast. Generating CSS and testing contrast turns the specification into checks that fail the build, and tone scopes let marketing pages use a dark emphasis surface without reintroducing ad hoc colour decisions.

## Trade-offs

Generated CSS files are committed and must be regenerated when tokens change. Tailwind classes in `packages/ui` rely on the apps scanning that package with `@source`. A reset palette means anyone needing a new colour must add a token and a reviewed contrast pair first, which is intended friction. The legacy colour aliases (`blue`, `slate`, `cloud`, `hairline`, `midnight`, `aqua`) exist only for the interim homepage and are removed when the commercial templates replace it.

## Consequences

Token changes require design review (ADR 008) and a passing contrast test. The blue and font decisions below remain open and are recorded in `docs/brand/token-reconciliation.md`: changing `blue600` or the font stacks is a one-token edit plus regeneration.

## Revisit triggers

The owner confirms or replaces `#2457FF` or the typefaces; Figma styles are reconciled and exported; a dark-mode or user-selectable theme becomes a requirement; token count or review load justifies an automated Figma-to-token pipeline (ADR 008).

## Clarification (workstream G1)

Decision 6 lists Source Serif 4 as part of the provisional set. In the web app only Geist Sans and Geist Mono are loaded (through the installed `geist` package and `next/font`); `--font-source-serif` is not set, so serif prose uses the stack's system fallback until the owner confirms the typeface and a build-time download or a bundled font file is approved. See `docs/brand/token-reconciliation.md`.
