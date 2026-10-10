# Token reconciliation

How the code tokens in `packages/design-tokens` relate to the Stage 9 section 4 colour system and the approved Figma board, and what is still awaiting the owner. Values and contrast ratios below are computed from the committed tokens (`packages/design-tokens/src/contrast.test.ts` asserts the pairs that components use).

## Reconciled to the specification

The Stage 1 baseline disagreed with Stage 9 section 4. The code now carries the exact spec values.

| Token                    | Baseline  | Now (Stage 9 section 4)         | Note                                       |
| ------------------------ | --------- | ------------------------------- | ------------------------------------------ |
| aqua-600                 | `#45E0D0` | `#007E76`                       | Old aqua was 1.6:1 on white; new is 4.9:1. |
| slate-700                | `#425466` | `#536273`                       | Secondary copy and metadata.               |
| border                   | `#CBD5DF` | `#D9E1E8`                       | Decorative rules only (see below).         |
| blue-700                 | absent    | `#1746DB`                       | Hover and pressed action.                  |
| midnight-800             | absent    | `#173247`                       | Dark borders and diagram strokes.          |
| slate-900                | absent    | `#26333F`                       | Default body copy on light surfaces.       |
| success, warning, danger | absent    | `#18794E`, `#9A6700`, `#C9372C` | Status only, always with an icon and text. |

Unchanged and already correct: midnight-950 `#081A2A`, cloud-50 `#F7F9FC`, white `#FFFFFF`.

## Open: Vitalos Blue `#2457FF` versus Cobalt `#2F6BFF` (owner decision)

- The strategy source locks Vitalos Blue as `#2457FF`; the approved Figma board (`docs/brand/asset-approval.md`) labels its primary Cobalt `#2F6BFF`. The plan and the specification keep `#2457FF` as authoritative until the Figma styles are reconciled, so `blue600` is `#2457FF` in code, with a comment pointing here.
- Measured effect of the choice (WCAG contrast):

| Pair                         | `#2457FF` | `#2F6BFF`                     |
| ---------------------------- | --------- | ----------------------------- |
| Blue text on white           | 5.4:1     | about 4.5:1 (at the AA limit) |
| White label on blue fill     | 5.4:1     | about 4.5:1 (at the AA limit) |
| Blue on midnight (`#081A2A`) | 3.3:1     | 3.9:1                         |

- `#2457FF` clears AA for text and for button labels with margin; Cobalt sits at the AA boundary, so adopting it would need a fresh contrast test run and probably a darker hover and link variant. In either case blue on midnight stays below 4.5:1, so it is for non-text decoration and large text only (the code never uses blue as dark-surface text).
- To change it: edit `colors.blue600` in `packages/design-tokens/src/primitives.ts`, regenerate the CSS (`UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test`), and rerun the tests. No component edits are needed.
- Status: pending owner confirmation. Do not alter the Figma file or the token value without it.

## Open: aqua usage

Spec aqua-600 `#007E76` is a data and intelligence accent, 4.9:1 on white and 4.7:1 on cloud. On midnight it is only 3.6:1, so it is not used for text there; the dark tone's accent role is white. The old bright aqua (`#45E0D0`) is not a spec token and is no longer used. If the owner wants a brighter aqua for dark surfaces, it must be added as a named token with its contrast pairs.

## Open: typefaces (provisional, pending owner confirmation)

- Stage 7 section 15.1 recommends Geist Sans, Source Serif 4 and Geist Mono "subject to final licensing and rendering validation". These are used provisionally:
  - Sans (interface and brand): Geist, variable.
  - Serif (long-form thought leadership, `Prose serif`): Source Serif 4.
  - Mono (technical artefacts): Geist Mono.
- Fallbacks follow the stack in `primitives.ts`: `ui-sans-serif`, `system-ui`, Segoe UI, Aptos (the Stage 7 office fallback), then generic families. The web app loads Geist Sans and Geist Mono through `next/font` (the installed `geist` package, self-hosted) and sets `--font-geist-sans` and `--font-geist-mono`. **Source Serif 4 is not loaded in the web app yet** (`--font-source-serif` is unset, so `Prose serif` falls back to the system serif stack): `next/font/google` would download the font at build time, which this repository avoids until the owner confirms the typeface and its hosting. Storybook uses `@font-face` for Geist from the `geist` package and shows a system serif where Source Serif 4 is not bundled.
- Needed from the owner: confirm the families, confirm licences (both families are published under open-source licences; verify the terms before launch), and approve rendering at the Stage 9 type roles. Changing families is a token and loader change, not a component change.

## Open: logo and favicon

Figma exports for the wordmark and symbol are not yet available. `Wordmark` is a typed slot (`logo?: { src, width, height, alt? }`) and renders the text `VITALOS` until the approved SVG is supplied. Favicon, app icons, Open Graph images and the Organization logo remain typed slots in the application layer and are not invented here. The descriptor shown in a logo lockup versus the website descriptor is tracked in `docs/delivery/stage-1-plan.md` and `docs/brand/asset-approval.md`.

## Contrast notes used by components

| Pair                                | Ratio             | Use                                                |
| ----------------------------------- | ----------------- | -------------------------------------------------- |
| slate-900 on white / cloud          | 12.9 / 12.2:1     | Body copy                                          |
| midnight-950 on white               | 17.6:1            | Headings                                           |
| slate-700 on white / cloud          | 6.3 / 5.9:1       | Secondary copy, control borders                    |
| cloud-50 / white on midnight-950    | 16.7 / 17.6:1     | Dark-surface text                                  |
| border `#D9E1E8` on midnight-950    | 13.3:1            | Muted text on the dark surface                     |
| white on midnight-800               | 13.3:1            | Dark control fill                                  |
| success / warning / danger on white | 5.4 / 4.9 / 5.2:1 | Status text (also on cloud, 4.6 or more)           |
| border `#D9E1E8` on white           | 1.3:1             | Decorative dividers only, never a control boundary |
