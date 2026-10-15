# ADR 024 Motion for React under progressive-enhancement rules

Status: Accepted (engineering), 10 Oct 2026. The owner approved Motion for React in the overnight directive (handoff of 10 Oct 2026, section 7; kept privately). Supersedes the "No Motion for React dependency" sentence of ADR-023 decision 4 and the related option rejected there; every other part of ADR-023 stands. Builds on ADR-016 (tokens), ADR-020 (CSP), ADR-021 (budgets and gates) and ADR-023. The conflicts with the strategy listed under "Conflicts and resolutions" are for owner review.

## Context

ADR-023 rebuilt the owner comp's entrance motion as a few hundred bytes of first-party code (`RevealController`, CSS transitions) and rejected Motion for React because it renders entrances at `opacity: 0` in the server HTML and costs tens of KB. The owner then asked for "nice effects with Framer Motion" across the header, heroes, body, footer, mobile and tablet (handoff section 7), with these rules: the server HTML shows the final visible state, `useReducedMotion` everywhere, `LazyMotion` with `domAnimation` (`domMax` only where drag is needed), client islands only, CSP unchanged, and budgets raised with a documented rationale (target at most +40 KB gzip on the homepage).

Stage 9 section 11 limits motion: hover 100 to 180 ms, menus 160 to 240 ms, section entrances 200 to 400 ms and optional, diagram sequences 400 to 800 ms where they explain a process, minimal page transitions, reduced motion removes translation and parallax, no scroll hijacking. Stage 9 sections 2, 17 and 20 and Stage 11 section 10 are cautious about parallax and carousels. Workstream R (`docs/research/content-and-design-direction.md` sections 7 and 8) turned these into per-element limits and recommended a two-column tablet sheet.

Motion can only start after hydration. Anything that must move on the first paint (the hero) would have to be hidden in the server HTML first, which the rules forbid.

## Decision

1. **`motion` 13.4.4, pinned, in `@vitalos/ui` only.** The exact version is the newest one at least two weeks old; scoped pnpm overrides pin its `framer-motion` 13.4.4, `motion-dom` 13.4.4 and `motion-utils` 13.3.0, so caret ranges cannot pull younger releases. The overrides do not touch the motion 14 that `@sanity/ui` brings for the Studio. A dependency-cruiser rule (`motion-only-in-ui`) forbids importing `motion` anywhere but `packages/ui`: apps use its islands.
2. **One island root.** Every Motion component renders inside `MotionIsland`: `LazyMotion features={domAnimation} strict` (so a full `motion.*` component, which would load every feature, fails loudly; islands use `m.*` from `motion/react-m`) and `MotionConfig reducedMotion="user"`. `domMax` is not used anywhere (see decision 8).
3. **The server HTML is the final state.** `useMotionAllowed()` is false on the server and on the hydration render and becomes true only afterwards when the visitor has not asked for reduced motion. Islands render `initial={false}` until then, so the markup carries no hidden, faded, clipped or translated state; no-JS visitors, crawlers and audits get complete pages. Nothing that is on screen when the page hydrates is ever hidden.
4. **No opacity on text in page content.** Entrances move and clip; they never fade text (ADR-023's contrast finding still holds: automated audits scroll content into view and would sample half-faded frames). Opacity is used only where Stage 9 names it and only after a visitor's action: the mega-menu panel reveal.
5. **Load-time motion is CSS, not Motion.** The hero headline settle (`SettleText`: each word visible from the first paint, rising 0.3 em into place, all words done within 400 ms), the hero planes and the hero panel settle and drift are keyframes behind `motion-safe`, so they start with the first paint, need no JavaScript and stop under reduced motion. All automatic movement ends 4.44 s after load: the panel settles from 240 to 840 ms, drifts twice for 1.8 s each and rests; the planes and the headline are done by 840 ms. That is inside the five seconds after which WCAG 2.2.2 would require a pause control. (Corrected 10 Oct 2026 after review: the first version drifted twice for 2.4 s each, which with the settle ran to 5.64 s; the independent review caught it.)
6. **What Motion drives** (all in `@vitalos/ui`, all static under reduced motion):
   - `Reveal`: below-the-fold content is lowered 24 px and clipped after hydration, then rises in once over 400 ms when it scrolls into view; the clip is removed afterwards. `Reveal stagger` is a group whose `RevealItem`s (rise, pop, draw) follow it in sequence. Commercial bands stagger their cards, rows and statements; `ProcessJourney` pops its numbered nodes and draws its connectors (600 ms each, 120 ms apart); the home "strategy to production" stage numbers pop in order; `TerminalCTA` and `SiteFooter` rise in once. Only hidden elements are watched, by one shared passive scroll and resize check per frame: an element is shown once its top passes 92 % of the viewport, which also catches content a jump (End key, anchor link, scroll restoration) carried past the viewport in one step, something an IntersectionObserver never reports. Nothing stays hidden above the visitor.
   - `MegaMenu`: on a visitor's opening, the panel fades and drops 6 px over 160 ms with its columns 25 ms apart (235 ms in all). Never on first paint; closing is instant.
   - `MobileNav` sheet: slides in on a spring that settles in about 220 ms with a top-down clip (no fade).
   - `Parallax`: one decorative element per page (the hero back plane), 24 px of travel over the first 600 px of normal page scroll, driven by a passive scroll listener into a Motion value (Motion's scroll-timeline engine is not loaded; that saved 5.3 KB gzip).
7. **Plain CSS where it is enough.** Card hover and keyboard-focus lift (4 px) and the arrow slide use the 140 ms feedback token. The header condense is a passive scroll listener (one check per frame) toggling `data-condensed`: the bar shrinks from 72 to 56 px (`--size-header-condensed`), turns 92 % opaque with a backdrop blur, and the header's bottom margin grows by exactly the height it lost on the same curve, so content below never moves (no layout shift, no scroll jump).
8. **Carousel: drag on native scrolling, no `domMax`.** The industries row is a stacked list below lg (one column on phones, two on tablets) and a native scroll-snap row from lg. A mouse or pen drags the row (pointer events, snapping suspended during the drag and the closing click swallowed); touch keeps native scrolling. Arrow Left/Right, Home and End move focus between items and page the row; the paging buttons stay; nothing auto-advances. Motion's `drag` would replace native scrolling with transforms, break focus-driven scrolling and snap, and need `domMax` (about 30 KB more), so it is not used.
9. **Route transition: a cross-document View Transition.** Every link is a plain `<a>` (ADR-023), so a route change is a document navigation and App Router soft navigations, where `AnimatePresence` exit animations are unreliable, do not occur. `globals.css` declares `@view-transition { navigation: auto }` with a 150 ms root crossfade, and names the header so it holds still, all inside `prefers-reduced-motion: no-preference`. No script, no inline `<style>`, nothing hidden in the server HTML; browsers without support navigate as before.
10. **CSP unchanged (ADR-020).** Motion writes inline `style` attributes and CSSOM properties only (`style-src 'unsafe-inline'` already allows attributes); no `<style>` element is injected and nothing uses `eval`. The security-header tests are unchanged and pass.
11. **Navigation states.** The primary action is in the bar at every width (from 320 px, with a nowrap compact size; the menu icon is dropped below 360 px to fit). The Trust Centre link is in the bar from 1024 px (it had no place in the header between 1024 and 1279 px). Below lg the menu is a sheet: native `<details>` without JavaScript; with it, focus is trapped in the trigger and sheet, every other part of the page is `inert`, page scroll is locked, Escape and a resize into lg close it, and focus returns to the trigger. Tablets (768 to 1023 px) get a two-column sheet with the section groups open beside the rows; phones keep nested disclosures whose first link is the section index. Rows and links are at least 44 px high below lg (wordmark, menu rows, footer links, breadcrumbs, the bar action).

## Conflicts and resolutions (for owner review)

| Brief asked for                                    | Strategy says                                                                           | Resolution                                                                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Mega-menu staggered reveal"                       | Menu/panel reveal 160 to 240 ms, "no theatrical delay" (S9 §11); R §7: 25 ms per column | 160 ms panel plus 25 ms column steps: 235 ms in all. Instant under reduced motion.                                                                                                |
| "Gentle plane parallax"                            | No parallax overload (S9 §2); remove parallax under reduced motion (S9 §11)             | One element per page (the hero back plane), 24 px of travel, decorative and `aria-hidden`, off under reduced motion. `Parallax` documents the one-per-page rule.                  |
| "Industries carousel with drag, snap and paging"   | Avoid carousels for essential content; vertical flow on mobile (S9 §17, §20; S11 §10)   | Stacked list on phones and tablets; row from lg only, with drag as an enhancement over buttons and keys; every item stays a normal link in the tab order; never auto-advances.    |
| "App-Router-safe route transition"                 | Page transition minimal; no SPA-style transitions (S9 §11); R: prefer none              | The lightest form: a 150 ms browser crossfade for document navigations, header held still, none under reduced motion, no script. Remove the 17 lines in `globals.css` to drop it. |
| "Hero staggered headline"                          | Do not animate the largest contentful element; finish within 400 ms (R §7 rule 2)       | Words are drawn at full colour from the first paint and only rise 0.3 em; CSS, within 400 ms; static under reduced motion.                                                        |
| "Section/card whileInView reveals" with a fade (R) | ADR-023: no opacity on text (contrast audits)                                           | Rise and clip only, never a fade; only content below the fold on hydration.                                                                                                       |
| "Drifting panel"                                   | Moving content over 5 s needs a pause control (WCAG 2.2.2; R §7 rule 7)                 | Settle (240 to 840 ms) then two 1.8 s drifts, at rest by 4.44 s after load (was 5.64 s before review).                                                                            |
| Talk to Vitalos only inside the menu below 448 px  | Compact header with wordmark, action and trigger (S8 §6, S9 §12); R §8 item 9           | The action is in the bar from 320 px.                                                                                                                                             |

## Options

- Keep ADR-023's CSS-only islands: rejected by the owner directive.
- Motion `whileInView` with `initial` hidden states: rejected; it renders entrances hidden in the server HTML.
- Motion for the hero entrance: rejected; it can only start after hydration, so the headline would have to be hidden first or would jump after being painted.
- Motion `drag` (`domMax`) for the carousel: rejected (decision 8).
- `AnimatePresence` page transitions in a `template.tsx`: rejected; there are no soft navigations to animate, exit animations are unreliable in the App Router, and Stage 9 asks for minimal page transitions.

## Reasons

The rules keep what ADR-023 protected (complete server HTML, no faded text, reduced motion, CSP, budgets) while giving the owner the richer motion asked for. Motion is used where it adds something CSS cannot do cleanly (scroll-triggered sequences, variant propagation for staggered groups, springs, scroll-linked transforms); CSS stays where it is smaller or must run before hydration.

## Trade-offs

Every `Reveal`, menu and parallax layer is now a client component, so hydration does a little more work. Every route ships about 34.6 KB more gzip JavaScript, almost all of it the shared Motion runtime in the layout chunk (see below). The hero settle is subtle by design. Cross-document View Transitions run in Chromium and recent Safari only. On a tablet the industries row is a two-column list, not a carousel.

## Consequences

- **JavaScript budgets** (first-party gzip bytes, `pnpm test:perf`, production build, fixtures, desktop Chromium). Before is `stage-1` at `22e96b1`; after is this branch.

  | Route (template)                                                       | Before  | After   | Change  | Budget before   | Budget after |
  | ---------------------------------------------------------------------- | ------- | ------- | ------- | --------------- | ------------ |
  | `/` (home)                                                             | 148,821 | 183,459 | +34,638 | 160,000         | 199,000      |
  | `/offers/:slug`, `/industries/:slug`                                   | 148,821 | 183,459 | +34,638 | 160,000         | 199,000      |
  | RichText and CmsImage templates (what we do, practice, solutions, ...) | 155,164 | 189,802 | +34,638 | 165,000–166,000 | 205,000      |
  | `/work`, `/insights`, `/labs` (client-side filter island)              | 155,764 | 190,402 | +34,638 | 166,000         | 206,000      |
  | `/labs/:type`                                                          | 149,643 | 184,281 | +34,638 | 160,000         | 200,000      |
  | 404 (183,459 once #47 put the 404 in the site shell)                   | 147,591 | 182,229 | +34,638 | 157,000         | 197,000      |
  | `/contact` first-party (enquiry form island)                           | 189,243 | 223,921 | +34,678 | 202,000         | 242,000      |
  | `/contact` third-party (Turnstile)                                     | 27,685  | 27,685  | 0       | 42,000          | 42,000       |
  | Default for a route without an entry                                   |         |         |         | 175,000         | 206,000      |

  The homepage is +34,638 B, inside the +40 KB target. The first full build measured +39,995 B; replacing `useScroll`/`useTransform` in `Parallax` with a passive listener brought it down. Budgets follow `budgets.json`'s own rule (measurement plus about 8 %, rounded up to 1,000 B). Rationale for the raise: the owner approved Motion for React and its runtime is shared by every template through the site shell (header, menus, footer and section reveals); lazy-loading the feature bundle would not reduce what a visit downloads, because the islands need it as soon as the page hydrates. The lab LCP and CLS values stay advisory and printed by the suite.

- `tests/performance/budgets.json` is updated to the new measurements plus about 8 % headroom, and its `_rationale` points here.
- `RevealController` is removed; `Reveal` keeps its props and adds `stagger`; `RevealItem`, `Parallax` and `SettleText` are new exports. `Carousel` switches from md to lg for the row.
- New tests: `tests/end-to-end/motion.spec.ts` (reduced motion: nothing runs or is held back and no island sets a transform; a motion-allowed control; menu sheet focus trap, inertness, scroll lock, Escape and focus return, closing at lg; tablet two-column sheet; header action and Trust Centre placement; header condense without layout shift), `tests/end-to-end/motion.nojs.spec.ts` (server HTML of fourteen templates hides nothing; every drawn text node at full opacity without JavaScript; native menu still works) and `tests/storybook/carousel.spec.ts` (keyboard and button paging, mouse drag). Unit tests cover the same contracts in `@vitalos/ui`.
- The responsive pass (320, 390, 430, 768, 834, 1024, 1280, 1440 and 1920 px across fifteen templates) fixed: the bar action wrapping at 320 px; the missing action below 448 px and Trust Centre at 1024 to 1279 px; tap targets under 44 px; meta labels breaking mid-word at 320 px; full-screen portrait placeholders on phones; a half-width rule under a lone statement; a cramped home strategy band at 1024 px; the hero visual's height on tablets. Not changed and left for design review: on institutional pages the narrow content column is centred rather than aligned with the header's left edge at 1440 px and wider.

## Revisit triggers

The site adopts `next/link` soft navigations (then use React `<ViewTransition>`, not `AnimatePresence`); approved Figma motion specifications arrive; field data shows the hydration cost matters; CSS scroll-driven animations become reliable enough to replace the `Reveal` island; a Motion major release (re-pin after two weeks, re-measure budgets).

## Amendment, 15 Oct 2026: ambient hero motion and the clear header (owner direction)

The owner asked for the homepage hero to sit on a supplied photograph under a black overlay, for
"a little movement here and there" in it, and for the header to be clear over the hero until the
page scrolls. This amends decision 5 (all automatic movement ends within five seconds) for the
homepage hero only:

- **Looping ambient motion, with a pause switch.** The hero photograph drifts (40 s, alternating);
  six points of light glint over it in turn; the `HeroVisual` `glass` panel floats a few pixels,
  its last step pulses, its bars breathe and a dashed data stream flows into it. These loop
  indefinitely, so WCAG 2.2.2 requires a way to stop them: `MotionPause` is a native checkbox
  ("Pause background motion") in the hero's bottom-right corner, and while it is checked every
  animation inside the hero's `[data-motion-scope]` is held (token CSS, "Ambient hero motion"). It
  works without JavaScript. Under reduced motion nothing in the hero runs, the glints are not
  drawn and the switch is hidden. Transform, opacity and stroke-dashoffset only; the panel fades in
  within 840 ms and its labels only slide, so decision 4 and `motion.nojs.spec.ts` still hold.
- **Clear header on the homepage.** `SiteHeader overlay` makes the expanded bar transparent and on
  the dark tone (white lockup) at the top of the page; it takes the light surface when the page
  scrolls (the existing condense threshold) or when a menu inside it opens, so open menus always
  sit on white. The hero starts under the bar (`-mt-(--size-header)`, with the same height added to
  its top padding), so the condense still moves no content. Every other page keeps the light bar.
  Server HTML and no-JS render the clear bar.

The same day the Industries band gained a looping aurora (`AuroraBackdrop`) under the same rules: its band is a `[data-motion-scope]` with its own MotionPause switch, and nothing moves under reduced motion.

The finite rule still applies everywhere else, including the `planes` variant of `HeroVisual`.
