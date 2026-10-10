# ADR 023 Web presentation from the owner comp

Status: Accepted (engineering). Supersedes the intent of "ADR 016 Web presentation stack and comp template" proposed in PR #31 (`feat/web-design-template`), which was never merged and whose number collides with the accepted ADR-016 here. Builds on ADR-008, ADR-016, ADR-020, ADR-021 and ADR-022; changes none of their decisions. Tints and type-role adjustments below are pending design review (ADR-008).

## Context

The owner supplied a standalone Next.js comp (`vitalos-web.zip`) as the reference for the look, rhythm and motion of the website. Two implementations followed:

- PR #31 ported the comp's visual design (split hero with a collage, icon cards with arrow discs, connected process steps, an industries carousel, a single-row closing band, a ruled footer, slide-arrow buttons and links, entrance motion and count-up figures) but brought its own CMS schemas, content repository, enquiry route, token files and information architecture (six practices with solutions nested under them), and used Motion for React, Inter and `lucide-react`.
- `stage-1` holds the governed architecture: the W0 contracts (routes, navigation, locked copy, view models, ContentSource, publication gates), the C1/C2 content model and fixtures, the G1 platform layer, the security headers and CSP (ADR-020), the enquiry pipeline (ADR-019), tokens and primitives (ADR-016), patterns, templates and the quality gates (ADR-021). Its pages were correct but visually plain.

A side-by-side capture of the comp, PR #31 and `stage-1` at 1440 and 390 px (kept outside the repository) showed the comp's presentation to be clearly stronger and `stage-1`'s architecture, governance and test coverage to be the one to keep. The comp's code, palette (`#0B5CFB`, `#082D71`), Manrope font, logos, photographs and sample claims (metrics, testimonials, client logos, case studies) must not be reused.

## Decision

1. **Keep `stage-1`'s architecture; port the comp's presentation onto it.** Nothing of PR #31's CMS schemas, content repository, enquiry route, token files or route tree is brought over. Templates keep reading `stage-1` view models through `getContentSource()`, and every section still renders only when the content and the publication gates allow it.
2. **The comp is re-implemented, never imported.** New and restyled components live in `@vitalos/ui` under its existing rules: no `next/*` or `@vitalos/cms` imports (dependency-cruiser), plain `<a>`, every visible string from props, tokens only (`check:raw-colours`), Storybook stories with artificial fixture text and axe at `error`.
3. **New `@vitalos/ui` pieces.**
   - Primitives: `SlideArrow` (CSS-only arrow swap on hover or focus), `CircleArrow` (decorative arrow disc), `IconTile` (monoline icon on a tinted tile) and thirteen monoline subject icons in the existing `Icon` set; `Button` gains `arrow`, and `TextLink` becomes the comp's arrowed link when standalone (inline links keep a permanent underline, WCAG 1.4.1).
   - Patterns: `SectionHeading` (eyebrow, large title, intro and onward link aligned to the title), `PageHero` (inner-page hero with a decorative angled plane), `HeroVisual` (homepage composition of token-tinted planes and a floating panel listing caller-supplied stage names, replacing the comp's photo collage and figures), `MediaPlaceholder` (token-only stand-in where the comp shows a photograph).
   - Motion islands (`packages/ui/src/motion`): `Reveal` + `RevealController`, `Carousel`, and `CountUp`.
   - Restyled: `FeatureCard` (icon tile, optional placeholder, arrow disc, hover lift without a resting shadow), `EditorialRow` (arrow disc, optional icon tile), `ProcessJourney` (numbered nodes joined by drawn connectors for up to five stages, a numbered grid beyond), `OutcomeStats`, `SiteHeader`, `SiteFooter`, `TerminalCTA` (the comp's single-row closing band).
4. **Motion is progressive and within Stage 9 section 11.** The server output is complete and visible without JavaScript. `RevealController` is one client island in the site shell; it does nothing under `prefers-reduced-motion: reduce` or without IntersectionObserver, never hides content already on screen, and reveals content below the fold once with a rise and a clip wipe (400 ms entrance; the process connector draws over 600 ms, the "diagram sequence" range). `Carousel` is a vertical list below md (no horizontal carousel for content on phones), a native scroll-snap row from md with paging buttons that are disabled at either end and inert without JavaScript, and never auto-advances. The hero planes use CSS keyframes behind `motion-safe`; the hero panel only moves (no fade), so text contrast holds in every frame. No opacity is animated on anything that carries text: automated audits scroll elements into view, and a half-faded frame would fail contrast (CI caught exactly that with a fade). No Motion for React dependency: the islands are a few hundred bytes of first-party code.
5. **Count-up never animates an unverified number.** `CountUp` is not exported from `@vitalos/ui`; only `OutcomeStats` uses it, after its existing filter (value, descriptor and source present, evidence `verified` when given). It renders the final figure on the server, keeps a visually hidden copy for assistive technology, parses only single-number figures and does nothing under reduced motion.
6. **CSP unchanged.** No inline `<style>` element and no `eval`; the only inline styling is React `style` attributes (CSS custom properties for stagger and bar heights), already allowed by ADR-020's `style-src 'unsafe-inline'`.
7. **Tokens.** Added, all in `@vitalos/design-tokens` and generated into CSS: three tints of the locked hues (`blue50 #EEF2FF`, `blue100 #DCE4FF`, `aqua50 #E6F4F2`) kept in a separate `tints` map so the Stage 9 section 4 `colors` set stays exact; tone roles `eyebrow` (brand blue on light, a light neutral on dark) and `tileBg`/`tileFg`, each with a tested contrast pair; easing `emphasis`; radius `xl` (12 px, selected media only); hero keyframes. Changed within the Stage 9 ranges: Display XL mobile 44 px, Display L desktop 60 px, H2 desktop 40 px with tighter leading and tracking, eyebrow tracking 0.14 em, section entrance 400 ms.
8. **Stage 9 governs where the comp conflicts with it.** Radii stay 4 to 8 px (12 px for hero media only); cards have no resting shadow (border and hover lift instead; the floating hero panel uses the floating elevation token); no proof strip, metric, testimonial, logo wall or case study appears without approved, verified CMS content; no stock or comp photography (token placeholders, marked decorative, or nothing); buttons stay small-radius, not pills.
9. **Information architecture stays `stage-1`'s (Stage 8).** Five practices under `/what-we-do/[practice]`, Solutions top-level at `/solutions/[slug]`, Labs its own section; PR #31's six practices and `/what-we-do/[practice]/[solution]` nesting are not adopted.
10. **Typography stays the provisional Geist set (ADR-016).** The comp's Manrope and PR #31's Inter are not adopted and no font dependency is added; the font choice remains an owner decision.
11. **Icons are chosen by the web app from locked names** (`apps/web/src/lib/view-mapping/icons.ts`), so content carries no presentation and unknown titles fall back to a neutral icon for their kind. Eyebrows above section headings reuse locked navigation and mega-menu labels (structural, no new copy).

## Options

- Merge PR #31 and rebuild the governance on it: rejected; it duplicates and conflicts with W0/C1/C2/D/E/G1 and the test suites.
- Keep `stage-1`'s presentation: rejected; the owner's comp is the agreed visual reference and the gap was large.
- Port with Motion for React: rejected; it renders entrances with `opacity: 0` on the server (content hidden without JavaScript) and costs tens of KB against the ADR-021 budgets.
- CSS scroll-driven animations (`animation-timeline: view()`) instead of an IntersectionObserver island: rejected for now; full-page captures and assistive-technology audits would see mid-animation states, and browser support is incomplete.

## Reasons

The owner's comp is the strongest presentation; `stage-1` is the only implementation that satisfies the governance, security, evidence and test requirements. Re-implementing the presentation in the shared packages keeps one design system for every template and keeps the gates meaningful.

## Trade-offs

The site no longer matches the comp exactly: colours, type, radii, shadows, imagery and sample proof follow the locked tokens, Stage 9 and the evidence rules. Pages are shorter than the comp until approved proof content exists. The tints and type-role adjustments need design review. The industries carousel is a list on phones.

## Consequences

- JavaScript budgets are unchanged: the homepage measured 148,729 gzip bytes of first-party JavaScript against a 160,000 budget (146,431 before), and every route stays inside its existing budget.
- PR #31 is superseded and should be closed without merging once the owner accepts this direction (owner action). Its ADR-016 file must not be merged: the number is taken.
- Tests changed only where markup legitimately changed: the homepage h1 is matched with its last clause in a colour span, and a verified outcome figure now appears twice (the visual copy and the copy for assistive technology).
- Latent issue recorded, not introduced: Chrome scrolls focus inside the Turnstile iframe without honouring the page's `scroll-padding`, so the widget can land partly under the sticky header in some layouts. The footer keeps its larger link size and padding below lg, which keeps the contact page clear of it; a robust fix needs Cloudflare widget support or a different challenge placement.

## Revisit triggers

Approved Figma templates (Direction 01) supersede the comp; the owner confirms or changes typefaces, Vitalos Blue or the tints; rights-cleared photography or approved proof content arrives (placeholders give way to `CmsImage` and the proof modules); a browser-native scroll-driven animation becomes reliable enough to replace `RevealController`.
