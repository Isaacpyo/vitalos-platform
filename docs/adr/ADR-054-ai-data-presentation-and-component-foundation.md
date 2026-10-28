# ADR 054 Vitalos AI & Data presentation and the interactive component foundation

- **Status:** Accepted (engineering), 28 Oct 2026.
- **Decided by:** the lead session (component foundation), 28 Oct 2026. Builds on ADR-020 (CSP), ADR-023 and ADR-024 (presentation and motion), ADR-052 (AI & Data foundation) and ADR-021 (budgets).
- **Scope:** the public marketing experience at `/ai-data` (home, demonstrator, solutions, approach). `/ai-data/contact` and the guided brief belong to a separate workstream and keep their own section at the end of this file (append-only).

## Context

The AI & Data section launched with text-led pages and a static demonstrator. The aim now is that Vitalos reads as an AI engineering company through the work surfaces themselves: a visitor can pick a sample task, see the input, step through the processing, review the structured result with its evidence, and see what still needs a person. The business model is customer-funded engineering (discover, prove, build, operate, and productise only where it is justified). Every claim stays honest: the demonstrations are scripted examples on synthetic data, not live AI, and no timer ever pretends that work is happening.

## Decision

### Component foundation

1. **`@vitalos/ui` stays the design system.** Interactive primitives are added to it as owned, shadcn-style source components built on **`@base-ui/react` 1.9.0** (MIT, published 9 Oct 2026, pinned exactly, in `packages/ui` only). A dependency-cruiser rule (`base-ui-only-in-ui`, beside `motion-only-in-ui`) forbids importing it anywhere else. No Radix and no second primitive system.
2. **What was added** (`packages/ui/src/interactive/`): `Popover`, `Dialog`, `Drawer` (right panel or bottom sheet, swipe to dismiss), `ToastProvider` with `useToast` and `useOptionalToast`, `Tabs`, `Tooltip`, `Collapsible`, `CopyButton` (visible and announced confirmation, optional toast, failure reported) and `Skeleton`. Each carries a docblock, Vitalos tokens only (`--tone-*` roles), 44 px targets, visible focus and short transitions that collapse under reduced motion. Tests cover roles, aria state, Escape, focus move and focus return (`interactive.test.tsx`). Stories are in `apps/storybook/stories/primitives/Interactive.stories.tsx` and are scanned by the storybook-a11y job.
3. **Entry point.** They are exported as `@vitalos/ui/interactive`, not from the main entry, so a route that does not use them never downloads Base UI. `@vitalos/ui` is also marked `"sideEffects": false` (nothing in it has import side effects), which lets bundlers drop unused primitives: `/ai-data/solutions` and `/ai-data/approach` got 4.9 KB gzip smaller from that alone.
4. **Portals and tone.** Overlays render outside the band that opened them, so they take the page tone as an attribute on the content component (`data-aid-tone="dark"`), spread onto the popup. The `ToastProvider` takes `viewportAttributes` for the same reason.
5. **CSP (ADR-020).** Base UI creates an inline `<style>` element only in `ScrollArea` and `Select`, and an inline `<script>` only in the `Slider` thumb and `Tabs.Indicator`. None of those is wrapped, and `CSPProvider` is therefore not needed: the wrappers never ask for a nonce. The enforced policy (`style-src 'unsafe-inline'`, `script-src 'unsafe-inline'`) is unchanged and `packages/security` is not touched. Base UI positions popups with CSSOM style properties, which the policy allows. The strict report-only variant, which drops `'unsafe-inline'` for scripts, stays clean for the same reason. `csp.test.tsx` fails if an open popover, dialog, drawer, tabs or toast ever renders a `<style>` or `<script>` element.
6. **Icons.** The in-house monoline set (24 px grid, 1.5 stroke, square caps) gains `copy`, `expand`, `flag`, `database`, `table`, `person` and `arrow-down`. No lucide: it would mix icon families.
7. **No React Flow and no Recharts.** The diagrams are small linear flows (four stages, input to outcome) and the only table of numbers is the evaluation table, which is a real HTML table. First-party markup and SVG are smaller, server-rendered and accessible. Neither library is added; revisit only for a genuinely interactive graph or a real data chart.

### Lazy loading

8. **Server HTML carries the essential content; heavy parts load on demand.**
   - The hero walkthrough, the reconciliation preview and the demonstrator work surface are server-rendered client components with plain React state (no Base UI). Their SSR output is complete.
   - The expanded demonstration (`ExpandedDemo`, a dialog and a toast provider) is `next/dynamic` and mounts only after "Open full view". A `Skeleton` is shown only while that chunk is genuinely being fetched.
   - The explanation popovers and the reviewer-task drawer use stand-in buttons (`lazy-overlays.tsx`): hovering or focusing starts the fetch, pressing mounts the real overlay, which opens and takes focus. No overlay code runs before a visitor reaches for one.

### Presentation

9. **Hero** (split layout): the headline "AI that takes work off your team's hands.", a scripted workflow component on the right (three synthetic tasks, four stages: input, read, check, review) and the two actions "Explore your workflow" (anchor to the explorer) and "Try a working example" (the demonstrator). Stages advance only when the visitor chooses; there are no timers and no typing effect. The surface is labelled "Synthetic data" and "Scripted example, not live AI". Each field and check expands to the source lines it cites.
10. **No-JS state.** `noscript:` (Tailwind's `@media (scripting: none)`) swaps the controls for a static walkthrough of the first task, so the panel is meaningful before and without hydration, and no dead button is shown.
11. **Workflow explorer** is a native radio group whose selected panel is shown by CSS (`:has(:checked)`). It works without JavaScript, all four panels are in the HTML, and a delegated listener only reports which slug was chosen. Each panel links to `/ai-data/contact?topic=<slug>` with the four shared slugs `finance-reconciliation`, `document-intake`, `customer-requests` and `operational-reporting`.
12. **Demonstrator** has three synthetic samples. The existing hand-prepared statement is kept, and two are taken line for line from evaluation dataset v1 (cases d03 and d02, `superadmin/apps/recon_demo/datasets/v1/dev/`), so the page shows inputs the evaluation ran on and the results follow that dataset's `expected.json`. The source document sits beside the results; matched items and exceptions are marked in text as well as colour; evidence expands; a reviewer-task drawer illustrates what a person decides (described, not live). The three-way split of AI, deterministic code and a reviewer is a section of its own. The detailed evaluation tables moved to a secondary "Evidence" section with the report data unchanged and AC-14 still "not run". The original excerpt and reconciliation tables remain as a plain-table fallback inside the Evidence section.
13. **Tokens.** One restrained teal "signal" role (active step, selected item, the person-decision panel) is added to `packages/design-tokens/src/ai-data.ts`, with contrast pairs for the signal on every surface and for text on its tint. `ai-data.css` is regenerated and `ai-data.test.ts` verifies every new pair.
14. **Motion** follows ADR-023 and ADR-024: the server HTML is the final state, there is no opacity on text, expansion is a short height transition, hover is subtle elevation and border emphasis, and reduced motion collapses every duration token.

### Measurement

15. **Events** (`apps/web/src/features/analytics/events.ts`, one block, slugs and enums only, no free text): `workflow_started` (the first funnel event, once per page view, from the hero or the explorer), `explorer_topic_selected`, `demo_sample_chosen`, `demo_stage_viewed`, `demo_evidence_expanded` and `ai_data_cta_click` (explore, try, open-expanded-demo, prepare-brief). They go through the existing cookieless Vercel sink, which stays a no-op unless `NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel`.

## Consequences: JavaScript budgets

Measured with `pnpm test:perf` (first-party JavaScript requested while loading a route, gzip bytes, production build, fixtures, desktop Chromium).

| Route                   | Before  | After   | Change | Budget before | Budget after |
| ----------------------- | ------- | ------- | ------ | ------------- | ------------ |
| `/ai-data`              | 195,982 | 205,166 | +9,184 | 206,000       | 222,000      |
| `/ai-data/demonstrator` | 195,982 | 200,106 | +4,124 | 206,000       | 206,000      |
| `/ai-data/solutions`    | 195,982 | 191,076 | -4,906 | 206,000       | 206,000      |
| `/ai-data/approach`     | 195,982 | 191,076 | -4,906 | 206,000       | 206,000      |
| `/ai-data/contact`      | 237,640 | 238,453 | +813   | 257,000       | 257,000      |

Lab LCP stayed between 170 and 450 ms on every route and CLS at 0.001 (advisory, as ever). The first paint is server HTML: the hero text, actions and the first stage of the walkthrough need no JavaScript. Chunks that load only on demand (gzip): Base UI core about 27 KB, the overlay module (popover and drawer) about 26 KB, the expanded-demo module about 8 KB. The home budget is raised because the hero walkthrough, the preview and the tracker are first-load interactive; the reasons are in `tests/performance/budgets.json`.

## Options

- Radix or another primitive set beside Base UI: rejected (one foundation).
- Base UI everywhere, loaded eagerly: rejected; about 50 KB gzip on every visit for features most visitors never use.
- Stage transitions on a timer to look like processing: rejected; honesty rule, nothing animates that is not caused by the visitor.
- A script-driven explorer: rejected; radios and CSS are smaller, work without JavaScript and keep every panel in the HTML for search.
- A fourth sample made up for the page: rejected; the two additions come from the evaluation dataset so they are consistent with it.

## Checks recorded for this change

Axe (WCAG 2.2 AA) on every AI & Data template and, in a separate scripted pass, on each hero stage, the open preview evidence, the expanded dialog, the demonstrator evidence, the drawer and the popover at 1440 and 390 px; no horizontal scroll at 320, 390 and 768 px; dialog focus trap and focus return; reduced-motion and no-JavaScript rendering of the hero. See `tests/end-to-end/ai-data.spec.ts` and `ai-data-experience.nojs.spec.ts`.

## Guided brief (appended by its own workstream)

_Reserved. The brief workstream appends its decisions here; do not edit the sections above for it._
