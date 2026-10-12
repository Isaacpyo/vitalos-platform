# Accessibility manual audit script (launch gate G5)

**Not yet performed. Nothing in this document records a completed audit.**

This is the script the owner (or a delegated auditor) follows to audit the Vitalos website against WCAG 2.2 Level AA, as launch gate G5 requires ("WCAG 2.2 AA target, keyboard/zoom/reflow audited", `docs/delivery/launch-gates.md`). It is an instrument for recording an audit. Every `Result` and `Notes` cell, and the sign-off block at the end, is blank on purpose. Until a named person has filled them in against a named build, G5 is open. Passing the automated suites does not close G5 (section 3). The requirements come from Stage 8 section 24 and Stage 9 sections 11, 12, 17 and 30 (`docs/strategy/`) and from ADR-021 (`docs/adr/ADR-021-quality-gates.md`).

Per Stage 8 section 24, the public accessibility statement must be published only after an evaluation, must be truthful, and must not use conformance badges as decoration. Nothing here supports any conformance claim; only a completed, signed-off run can.

## 1. How to record a result

- Fill the `Result` column with exactly one of: `Pass`, `Fail`, `N/A` (say why in Notes), `Blocked` (say why).
- On `Fail`, log an issue (section 9) and put its number in Notes. Do not edit the expected result to fit what you saw.
- Record the exact build under test (commit SHA, content source, fixture set) in the sign-off block. A result applies only to that build.
- Work on a copy (for example `docs/operations/accessibility-audit-<date>.md`, or an issue attachment) so this file stays blank for the next audit.

## 2. Scope and environment

### 2.1 Scope

In scope: every page template in 2.4 at desktop (1440px), tablet (about 768px) and mobile (390px), including the 404 page. Out of scope: the contents of Cloudflare's Turnstile iframe (Cloudflare's document; record only how it behaves inside our page, see CT-08 to CT-10), and Storybook (covered by `test:storybook-a11y`). Gated sections (Industries, Work, Insights, Labs, Careers) are audited only when their gate is open, which the `full` fixture set does.

### 2.2 Browsers, assistive technology and versions to record

Record the exact version of everything you use in the sign-off block. Read versions from the application; do not guess.

| Role                           | Combination                                                           | Notes                                                                                        |
| ------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Primary screen reader          | NVDA with Firefox, Windows                                            | Record NVDA and Firefox versions. Use browse mode and focus mode.                            |
| Secondary screen reader        | VoiceOver with Safari, macOS                                          | Record macOS and Safari versions. Use the rotor (landmarks, headings, links, form controls). |
| Mobile screen reader (iOS)     | VoiceOver with Safari, iOS                                            | Record iOS version and device. Swipe navigation and the rotor.                               |
| Mobile screen reader (Android) | TalkBack with Chrome, Android                                         | Record Android, TalkBack and Chrome versions and device. Swipe and explore by touch.         |
| Keyboard, zoom, reflow, motion | Chrome (or Edge) and Firefox on desktop; Safari on macOS if available | Keyboard only, no mouse. Zoom and text-spacing checks in at least two engines.               |
| Optional                       | Windows High Contrast or forced colours, Narrator, JAWS               | Record only if used.                                                                         |

Also record the operating system, display scaling, and any browser extensions (disable ad blockers and accessibility extensions for the run, or record them).

Spot-check tools (none replaces the human judgement asked for): a contrast checker that accepts two colour values or samples a pixel; the browser's accessibility tree inspector; a text-spacing bookmarklet or user stylesheet (T-01); the browser's reduced-motion emulation or the operating system setting.

### 2.3 Running the site locally with fixtures

Everything runs without a remote service or secret (`docs/operations/local-development.md`). Use Node 24 and Corepack. `NEXT_PUBLIC_*` values are inlined at build time, so export the environment before building and keep it for `start`. From the repository root:

```sh
corepack pnpm install --frozen-lockfile
export NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3210
export VITALOS_DEPLOY_ENV=local
export VITALOS_CONTENT_SOURCE=fixtures VITALOS_FIXTURE_SET=full
export VITALOS_ENQUIRY_BACKEND=memory ENQUIRY_PRIVACY_NOTICE_VERSION=0.0-fixture
# Cloudflare's documented Turnstile TEST keys (they protect nothing); see local-development.md.
export NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
export TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
export ENQUIRY_IP_HASH_SALT=local-audit-only-salt-not-a-secret
export OUTBOX_DISPATCH_SECRET=local-audit-only-outbox-secret-not-a-secret
export EMAIL_PROVIDER=none
corepack pnpm --filter @vitalos/web exec next build
corepack pnpm --filter @vitalos/web exec next start --hostname 127.0.0.1 --port 3210
```

Then open `http://127.0.0.1:3210`. This mirrors the environment in `playwright.config.ts` (the e2e web server), which is the authoritative source if the variables change; see also handoff section 3. Notes:

- Audit a production build, not `corepack pnpm dev:web`: development adds overlays and different hydration timing. `dev:web` is fine for a first look.
- The contact form renders only when enquiries can be stored and a privacy notice is published. `VITALOS_ENQUIRY_BACKEND=memory` is test-only and process-local; the fixture privacy page carries version `0.0-fixture`, which `ENQUIRY_PRIVACY_NOTICE_VERSION` must match. Never use real keys and never put a secret in a file or a command you share.
- `VITALOS_FIXTURE_SET=full` opens every publication gate so every template in 2.4 exists. `sparse` closes them and is not an audit set. The default `empty` source shows the honest empty state and 404s detail routes (useful only for the gated-state rows).
- Fixture slugs are the artificial ones from `tests/support/routes.ts`. Fixture copy is placeholder text marked "(fixture)"; judge structure and behaviour, not wording.
- `VITALOS_CONTENT_SOURCE=draft` is available after ADR-025 lands (handoff section 7: repo-authored draft content under `packages/cms/src/draft/**`, shown with a visible "Draft content, pending approval" ribbon, allowed locally and in preview and staging, rejected in production). It does not exist before that; do not use it until it does. When it exists, run this script again against it: real-length drafted content (long headings, many cards, long articles) stresses reflow, zoom, heading structure and link names far harder than fixtures. Also check that the ribbon is announced sensibly and never obscures focus (2.4.11). A `draft` run is a different build for sign-off purposes.
- A final run is needed against the approved repo content on a staging or preview deployment before launch, because G5 applies to what visitors will actually get. Previews sit behind Vercel's login; arranging access is an owner action.

### 2.4 Template inventory and URLs (fixtures, `full` set)

| Code | Template             | URL                                          |
| ---- | -------------------- | -------------------------------------------- |
| HOME | Home                 | `/`                                          |
| WWD  | What We Do index     | `/what-we-do`                                |
| PRAC | Practice             | `/what-we-do/example-practice`               |
| SOLX | Solutions index      | `/solutions`                                 |
| SOL  | Solution             | `/solutions/example-solution`                |
| OFFX | Offers index         | `/offers`                                    |
| OFF  | Offer                | `/offers/example-offer`                      |
| INDX | Industries index     | `/industries`                                |
| IND  | Industry             | `/industries/example-industry`               |
| HWW  | How we work          | `/how-we-work`                               |
| WRKX | Work index           | `/work`                                      |
| CASE | Case study           | `/work/example-case-study`                   |
| INSX | Insights index       | `/insights`                                  |
| ART  | Article              | `/insights/example-insight-1`                |
| PPL  | Person profile       | `/people/example-person`                     |
| LEAD | Leadership           | `/about/leadership`                          |
| LABX | Labs index           | `/labs`                                      |
| LABT | Labs type (category) | `/labs/open-source`                          |
| LABA | Lab asset            | `/labs/open-source/example-open-source-tool` |
| TRSX | Trust overview       | `/trust`                                     |
| TRS  | Trust topic          | `/trust/security`                            |
| ABT  | About                | `/about`                                     |
| CARX | Careers index        | `/careers`                                   |
| CAR  | Role                 | `/careers/example-role`                      |
| CT   | Contact              | `/contact`                                   |
| LGL  | Legal                | `/legal/privacy`                             |
| 404  | Not found            | `/this-page-does-not-exist`                  |

Route patterns are defined in `packages/cms/src/routes.ts` (ADR-022) and the page templates live under `apps/web/src/templates/`. If a template is added after this script was written, add a section for it before signing off; `tests/support/routes.ts` is the manifest the automated suites use and the quickest way to see what exists.

## 3. What is already automated, and what only a human can judge

The automated suites are a floor: they find a subset of defects reliably on every change. They cannot tell you whether the site is usable. Do not redo their work by hand; spend the time on the right-hand column.

| Property                                                                                                                          | Automated today (spec)                                                                                                                                                                                                                           | Still needs a human                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule-based WCAG 2.2 A/AA defects (axe-core tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`)                           | `tests/accessibility/templates.spec.ts` on every template and the 404, at 1440px and 390px; `tests/accessibility/baseline.spec.ts` (home); `tests/end-to-end/contact.spec.ts` (after validation errors); Storybook stories via `tests/storybook` | What axe cannot test: meaningful alt text, link text that makes sense out of context, heading outline, reading order                              |
| One `h1` and one `main` per template                                                                                              | `tests/accessibility/templates.spec.ts`                                                                                                                                                                                                          | Whether the `h1` and the headings below it describe the page                                                                                      |
| Skip link is the first Tab stop and moves focus to `main`                                                                         | `tests/accessibility/baseline.spec.ts` (home only)                                                                                                                                                                                               | Every other template; whether the link is legible and unclipped when focused                                                                      |
| Reflow with no horizontal scroll at 320px (SC 1.4.10)                                                                             | `tests/accessibility/templates.spec.ts` (every template), `baseline.spec.ts`, `tests/support/overflow.ts`, `tests/end-to-end/contact.spec.ts`                                                                                                    | Clipped or overlapping content, controls that become unusable, 400% zoom in real browsers, two-dimensional content (code, tables)                 |
| Reduced motion                                                                                                                    | `tests/accessibility/templates.spec.ts`: `scroll-behavior: auto`, no transition over 1ms, no running animation over 1ms on five sample pages, plus a control proving motion is on otherwise                                                      | Whether the page is still understandable and complete without motion; pages outside the sample; the operating system setting reaching the browser |
| Focus not obscured by the sticky header (SC 2.4.11)                                                                               | `tests/accessibility/templates.spec.ts`: Tab and Shift+Tab through nine long pages, and focusing elements scrolled under the header                                                                                                              | The other templates; zoomed views; any banner or ribbon; whether the indicator is visible and has enough contrast (SC 2.4.7, 1.4.11)              |
| Mobile navigation and mega-menu keyboard behaviour                                                                                | `tests/end-to-end/journeys.spec.ts` ("compact navigation", "desktop mega-menu": Enter, Space, Escape, tab order, hover plus Escape per SC 1.4.13)                                                                                                | Screen reader announcements; real touch devices; whether the tab order feels logical                                                              |
| Enquiry form: labels, input types, autocomplete, error summary takes focus, inline errors, `aria-invalid`, values kept, receipt   | `tests/end-to-end/contact.spec.ts`; no-JS behaviour in `tests/end-to-end/contact.nojs.spec.ts`                                                                                                                                                   | Screen reader experience of errors, live regions and the receipt; Turnstile behaviour; wording clarity (SC 3.3.x)                                 |
| Works without JavaScript                                                                                                          | `tests/end-to-end/no-js.nojs.spec.ts`, `proof.nojs.spec.ts`, `contact.nojs.spec.ts`                                                                                                                                                              | Every other template without JS, by eye; carousel buttons are inert without JS by design                                                          |
| Colour contrast                                                                                                                   | axe `color-contrast` on rendered pages; design-token contrast tests; `check:raw-colours`                                                                                                                                                         | Text over images or gradients, focus rings and borders (SC 1.4.11), hover and disabled states, states axe does not render                         |
| Component semantics                                                                                                               | Unit tests in `packages/ui/src` (for example `SkipLink`, `Disclosure`, `FormErrorSummary`, `MobileNav`, `MegaMenu`, `motion.test.tsx`) and Storybook axe                                                                                         | How components behave together on a real page with a screen reader                                                                                |
| Target size (SC 2.5.8)                                                                                                            | Only whatever axe's `target-size` rule reports where enabled                                                                                                                                                                                     | Section 4.7                                                                                                                                       |
| Text spacing (SC 1.4.12), 200% and 400% zoom                                                                                      | Not automated                                                                                                                                                                                                                                    | Sections 4.3 and 4.4                                                                                                                              |
| Screen reader output                                                                                                              | Not automated                                                                                                                                                                                                                                    | Sections 4.8 and 6                                                                                                                                |
| Meaning of images, diagrams, charts, code blocks, tables                                                                          | Not automated                                                                                                                                                                                                                                    | Alt text quality, text alternatives for diagrams, accessible code blocks (Stage 9 sections 17 and 30)                                             |
| Plain language, consistent navigation and help, redundant entry, accessible authentication (SC 3.2.3, 3.2.4, 3.2.6, 3.3.7, 3.3.8) | Not automated                                                                                                                                                                                                                                    | R-14, R-15, CT-08, CT-09, CT-15                                                                                                                   |

Before starting, run `corepack pnpm test:a11y` on the same build (needs Chromium via `corepack pnpm exec playwright install chromium`; see `playwright.config.ts`) and record the result in the sign-off block. A red automated run is a blocker for the human audit: fix first, then audit.

## 4. Common checks (run on every template)

These apply to every template. Run all of them on the home page and the contact page, and the minimum set in 4.9 on every other template. Each row has a stable ID so issues can cite it. Section 5 adds the checks that are specific to each template.

Method for keyboard checks: put the mouse aside and use Tab, Shift+Tab, Enter, Space, arrow keys and Escape only.

### 4.1 Keyboard (K)

| ID   | Check                                                                 | WCAG 2.2 SC          | Steps                                                                                                                                                              | Expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Result | Notes |
| ---- | --------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----- |
| K-01 | Skip link is the first Tab stop                                       | 2.4.1                | Load the page. Press Tab once.                                                                                                                                     | Focus lands on a link labelled "Skip to main content". It becomes visible, legible, unclipped and not hidden behind the header.                                                                                                                                                                                                                                                                                                                                                                                                      |        |       |
| K-02 | Skip link works                                                       | 2.4.1, 2.4.3         | With the skip link focused press Enter, then Tab.                                                                                                                  | Focus moves to the `main` landmark. The next Tab goes to the first focusable element inside `main`, not back to the header.                                                                                                                                                                                                                                                                                                                                                                                                          |        |       |
| K-03 | Tab order follows reading order                                       | 2.4.3, 1.3.2         | Tab through the whole page from the top, noting each stop. Compare with the visual order.                                                                          | Order is header, main content (top to bottom, left to right), then footer. No unexpected jumps, no off-screen stops, nothing skipped that a keyboard user needs.                                                                                                                                                                                                                                                                                                                                                                     |        |       |
| K-04 | Every interactive element is reachable and operable                   | 2.1.1                | Reach and activate every link, button, field and disclosure: Enter for links, Enter or Space for buttons, Space for checkboxes.                                    | Everything a mouse user can do can be done by keyboard. Buttons are buttons and links are links.                                                                                                                                                                                                                                                                                                                                                                                                                                     |        |       |
| K-05 | No keyboard trap                                                      | 2.1.2                | Tab forwards through the page to the browser chrome, then Shift+Tab back to the start. Repeat from inside any open menu, disclosure and the form.                  | Focus is never stuck. Any open panel can be left with Tab, Shift+Tab or Escape.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |        |       |
| K-06 | Focus indicator visible                                               | 2.4.7                | Tab through the page watching the indicator on links, buttons, fields, summaries and carousel buttons, on light and dark sections.                                 | Every focused element has a clearly visible indicator, consistent in style, on every background.                                                                                                                                                                                                                                                                                                                                                                                                                                     |        |       |
| K-07 | Focus indicator contrast                                              | 1.4.11               | Sample the indicator against its adjacent colours with a contrast checker.                                                                                         | At least 3:1 against adjacent colours on light and dark sections.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |        |       |
| K-08 | Focus not obscured by the sticky header or any overlay                | 2.4.11               | Tab forwards and backwards through the page to the footer. Also follow an in-page link and use the skip link. Watch for the draft ribbon, banners and widgets.     | The focused element is never fully or partly hidden behind the sticky header, a banner or a widget, at 100%, 200% and 400% zoom. (Automation covers nine templates at default zoom only.)                                                                                                                                                                                                                                                                                                                                            |        |       |
| K-09 | Primary navigation by keyboard (desktop, 1440px)                      | 2.1.1, 4.1.2         | Tab to the primary navigation. Activate each top-level link with Enter. For the What We Do mega-menu use Enter or Space on its button, then Tab into the panel.    | Every item is reachable. The mega-menu button exposes expanded or collapsed state; the panel opens on Enter or Space; its links follow in a sensible tab order; every destination in it is also reachable another way.                                                                                                                                                                                                                                                                                                               |        |       |
| K-10 | Mega-menu Escape and focus return                                     | 2.1.1, 1.4.13, 2.4.3 | Open the mega-menu by keyboard, Tab into it, press Escape. Repeat after opening it by hover with a fine pointer.                                                   | Escape closes it and returns focus to its button. Hover-opened content can also be dismissed with Escape and stays open while the pointer moves onto it.                                                                                                                                                                                                                                                                                                                                                                             |        |       |
| K-11 | Mobile navigation by keyboard (below 1024px, or at 200% to 400% zoom) | 2.1.1, 4.1.2, 2.1.2  | Narrow the window or zoom until the Menu control appears. Focus it, press Enter to open, Tab through the panel, press Enter or Space on the Menu control to close. | Opens and closes from the keyboard with expanded state exposed. Nested section disclosures open and close from the keyboard and their first link is the section index. Tab order is logical. The panel stays inside the viewport and scrolls if short. Closing leaves focus on the Menu control.                                                                                                                                                                                                                                     |        |       |
| K-12 | Mobile navigation focus model and Escape                              | 2.1.2, 2.4.3, 2.4.11 | With the mobile panel open, Tab past its last link and Shift+Tab before its first. Press Escape. Note which model the build uses.                                  | The current design is a native `<details>` disclosure (`packages/ui/src/patterns/site/MobileNav.tsx`), not a modal: focus is expected to continue to the page behind with no trap, and nothing of the page is hidden under an open panel. If the build uses a modal sheet instead, it must trap focus while open, close on Escape, return focus to the Menu control and make the page behind inert. Fail if neither model is applied consistently (for example focus is lost behind an open overlay). Record which model was tested. |        |       |
| K-13 | Carousel paging by keyboard (where present)                           | 2.1.1, 2.2.2, 4.1.2  | Reach the previous and next buttons with Tab. Activate with Enter and Space. Tab through the items.                                                                | Buttons have clear names, page by one item, are disabled (and exposed as disabled) at either end, and every item stays in the tab order. Focusing an off-screen item scrolls it into view and is not obscured. Nothing auto-advances. Below the `md` breakpoint it is a plain vertical list.                                                                                                                                                                                                                                         |        |       |
| K-14 | Disclosures and accordions (FAQs, filters)                            | 2.1.1, 4.1.2         | Operate each with Enter and Space.                                                                                                                                 | State is exposed, content opens and closes, focus stays on the trigger, open content is reachable.                                                                                                                                                                                                                                                                                                                                                                                                                                   |        |       |
| K-15 | Escape and dismissal                                                  | 2.1.1, 1.4.13        | Open anything transient (mega-menu, hover or focus popovers) and press Escape.                                                                                     | It closes without side effects and focus is not lost.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |        |       |
| K-16 | No single-key shortcuts                                               | 2.1.4                | Press letter keys with nothing focused.                                                                                                                            | No page-defined single-key shortcut fires. (Expected: none exist.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |        |       |
| K-17 | No unexpected context change                                          | 3.2.1, 3.2.2         | Tab through every control and change selects and checkboxes.                                                                                                       | Nothing navigates, submits or moves focus merely because a control was focused or its value changed.                                                                                                                                                                                                                                                                                                                                                                                                                                 |        |       |

### 4.2 Pointer and gestures (P)

| ID   | Check                             | WCAG 2.2 SC  | Steps                                                                                               | Expected result                                                                                                                      | Result | Notes |
| ---- | --------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----- |
| P-01 | No drag-only or path-only gesture | 2.5.1, 2.5.7 | On touch and with a pointer use each carousel and any swipe or drag behaviour.                      | Everything a drag or swipe does can also be done with a single tap or click, using the visible previous and next buttons.            |        |       |
| P-02 | Pointer cancellation              | 2.5.2        | Press a button or link, move off it and release.                                                    | The action does not fire on pointer down and is cancelled by moving away before release.                                             |        |       |
| P-03 | Label in name                     | 2.5.3        | Compare each control's visible text with its accessible name (accessibility tree or screen reader). | The accessible name contains the visible text in the same order. Icon-only controls (carousel buttons, Menu) have a meaningful name. |        |       |
| P-04 | Content on hover or focus         | 1.4.13       | Trigger hover or focus content (mega-menu on hover, tooltips).                                      | It is dismissible (Escape), hoverable (the pointer can move onto it) and persistent until dismissed or no longer relevant.           |        |       |

### 4.3 Reflow and zoom (Z)

| ID   | Check                          | WCAG 2.2 SC    | Steps                                                                                                          | Expected result                                                                                                                                                                                                                             | Result | Notes |
| ---- | ------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| Z-01 | 200% browser zoom              | 1.4.4, 1.4.10  | In a 1440px-wide window set zoom to 200% (720 CSS px). Scroll the whole page. Use the navigation and any form. | All content and functionality remain. No clipped or overlapping text. Navigation is usable. The sticky header leaves a usable reading area.                                                                                                 |        |       |
| Z-02 | 200% text-only resize          | 1.4.4          | In Firefox use View, Zoom, Zoom Text Only (or set a 200% default font size) and scroll the page.               | Text scales to 200% without loss of content or function and without overlap.                                                                                                                                                                |        |       |
| Z-03 | 400% zoom, 320 CSS px reflow   | 1.4.10         | In a 1280px-wide window set zoom to 400% (320 CSS px), or use a 320px-wide window. Scroll vertically.          | Content reflows to one column with no horizontal page scroll and no loss of content or function. Code blocks, data tables and diagrams may scroll inside their own container, never the page. (Automation checks page-level overflow only.) |        |       |
| Z-04 | Navigation at 400% zoom        | 1.4.10, 2.1.1  | At 400% zoom open the Menu control and walk through the panel.                                                 | The panel fits the viewport or scrolls inside itself, every link is reachable and the Talk to Vitalos call to action stays reachable.                                                                                                       |        |       |
| Z-05 | Sticky header at 200% and 400% | 2.4.11, 1.4.10 | At 200% and 400% zoom Tab through the page.                                                                    | No focused element is hidden behind the sticky header.                                                                                                                                                                                      |        |       |
| Z-06 | Orientation                    | 1.3.4          | On a phone or tablet rotate between portrait and landscape.                                                    | Content is usable in both orientations; nothing locks to one.                                                                                                                                                                               |        |       |
| Z-07 | Pinch zoom allowed             | 1.4.4          | On a phone try pinch zoom. View the viewport meta tag.                                                         | Pinch zoom works; the viewport meta does not set `user-scalable=no` or `maximum-scale=1`.                                                                                                                                                   |        |       |

### 4.4 Text spacing (T)

| ID   | Check                   | WCAG 2.2 SC   | Steps                                                                                                                                                                                                                      | Expected result                                                                                                                                                                                                                          | Result | Notes |
| ---- | ----------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| T-01 | Text spacing override   | 1.4.12        | Apply a text-spacing bookmarklet or user style: line height 1.5 times font size, paragraph spacing 2 times, letter spacing 0.12 times and word spacing 0.16 times (use `!important`). Scroll the page at 1440px and 390px. | No loss of content or function: no clipped, truncated or overlapping text; controls stay usable; headings, buttons, tags and cards grow with their text. Check the header, the mega-menu panel, cards, buttons, the form and the footer. |        |       |
| T-02 | Fixed-height containers | 1.4.12, 1.4.4 | Look for fixed-height boxes (hero, cards, carousel items, header) under T-01 and Z-02.                                                                                                                                     | Boxes grow or scroll without clipping text.                                                                                                                                                                                              |        |       |

### 4.5 Motion, no JavaScript and preferences (M)

| ID   | Check                                      | WCAG 2.2 SC                                               | Steps                                                                                                                              | Expected result                                                                                                                                                                                                                                                 | Result | Notes |
| ---- | ------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| M-01 | Reduced motion                             | 2.2.2, 2.3.3 (AAA; applied as policy), Stage 9 section 11 | Enable reduce motion at operating system level (or emulate it) and reload. Scroll the whole page, open the menu, use the carousel. | No non-essential motion: no reveal animation, parallax, drifting panel, count-up or smooth scrolling. Everything is in its final visible state at first paint. The carousel pages instantly. The page is fully understandable. (Automation samples five pages.) |        |       |
| M-02 | Motion allowed                             | 2.2.2, 2.3.1                                              | With motion allowed, scroll the page and watch the hero and reveal effects.                                                        | Nothing flashes more than three times per second. Nothing auto-plays or auto-advances for more than five seconds without a pause control. Normal scrolling is not hijacked (Stage 9 section 11).                                                                |        |       |
| M-03 | No JavaScript                              | 1.3.1, 2.1.1                                              | Disable JavaScript and reload. Check the heading, navigation, links, disclosures and any form.                                     | All content is present (nothing hidden waiting for JavaScript). Primary navigation works. Native disclosures open. On the contact page, errors are server-rendered. Carousel buttons stay disabled while the row still scrolls natively.                        |        |       |
| M-04 | Forced colours or high contrast (optional) | 1.4.11, 1.4.1                                             | Enable Windows High Contrast or forced colours and inspect the page.                                                               | Text, borders, focus rings and icons remain visible; nothing relies on a background image or colour alone.                                                                                                                                                      |        |       |
| M-05 | Colour scheme preference (if offered)      | 1.4.3, 1.4.11                                             | Switch the system colour scheme.                                                                                                   | No change, or contrast requirements still hold. Record N/A if the site offers no dark scheme.                                                                                                                                                                   |        |       |

### 4.6 Colour contrast spot checks (C)

| ID   | Check                                                 | WCAG 2.2 SC   | Steps                                                                                                            | Expected result                                                                                                                                                                   | Result | Notes |
| ---- | ----------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| C-01 | Body text                                             | 1.4.3         | Sample foreground and background of body copy in light and dark sections.                                        | At least 4.5:1 (3:1 for large text: 24px, or 18.66px bold, and above). Body text is never placed directly on brand blue or aqua without verified contrast (Stage 9 colour rules). |        |       |
| C-02 | Muted, caption and metadata text                      | 1.4.3         | Sample muted text, tags, eyebrows, breadcrumbs and footer text, including on dark sections and cards.            | At least 4.5:1.                                                                                                                                                                   |        |       |
| C-03 | Text over images, gradients and the angled hero plane | 1.4.3         | Sample text at the lightest and darkest parts of anything behind it.                                             | At least 4.5:1 at the worst point, or an opaque backing is used.                                                                                                                  |        |       |
| C-04 | Links are distinguishable                             | 1.4.1         | Look at in-text links in paragraphs and rich text.                                                               | Links are not distinguished by colour alone (underline or another cue), or have at least 3:1 against surrounding text plus a second cue on hover and focus.                       |        |       |
| C-05 | Non-text contrast: controls, borders, icons           | 1.4.11        | Sample input borders, checkbox and select outlines, carousel button borders, meaningful icons and chart strokes. | At least 3:1 against adjacent colours in default, hover and focus states (disabled controls are exempt).                                                                          |        |       |
| C-06 | State is not colour alone                             | 1.4.1         | Look at active navigation, errors, required fields, selected filters and status messages.                        | Each state is also conveyed by text, an icon with a text alternative, weight or pattern.                                                                                          |        |       |
| C-07 | Hover and focus states                                | 1.4.3, 1.4.11 | Hover and focus buttons, cards and links and sample the changed state.                                           | Contrast requirements still hold in every state.                                                                                                                                  |        |       |

### 4.7 Target size and touch (S)

| ID   | Check                                 | WCAG 2.2 SC           | Steps                                                                                                                                                                               | Expected result                                                                                                                                                                                                              | Result | Notes |
| ---- | ------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| S-01 | Target size minimum, 24 by 24 CSS px  | 2.5.8                 | With the inspector measure small controls: icon buttons, carousel buttons, footer links, breadcrumb links, tags, links in dense lists, the Menu control, checkboxes. Test at 390px. | Each target is at least 24 by 24 CSS px, or a 24px circle centred on it overlaps no other target, or it is an inline link in a sentence, or an equivalent target exists. Record each failure with element and measured size. |        |       |
| S-02 | Comfortable touch use (guidance only) | 2.5.5 (AAA; guidance) | On a real phone tap primary actions, navigation items and form controls.                                                                                                            | Primary actions are tapped without error. Record difficulty in Notes; do not mark Fail on this row alone.                                                                                                                    |        |       |
| S-03 | Spacing between adjacent targets      | 2.5.8                 | Check stacked footer links and list links at 390px.                                                                                                                                 | Adjacent targets do not overlap and meet S-01.                                                                                                                                                                               |        |       |

### 4.8 Screen reader checks (R)

| ID   | Check                                   | WCAG 2.2 SC         | Steps                                                                                                   | Expected result                                                                                                                                                                                                                                                                 | Result | Notes |
| ---- | --------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| R-01 | Page title and language                 | 2.4.2, 3.1.1, 3.1.2 | Read the page title on load. Inspect `<html lang>`.                                                     | The title is unique and describes the page; the language is `en-GB`; any passage in another language has its own `lang`.                                                                                                                                                        |        |       |
| R-02 | Landmarks                               | 1.3.1, 2.4.1, 1.3.6 | List landmarks (NVDA: Elements List or D key; VoiceOver: rotor Landmarks; TalkBack: reading controls).  | One banner, navigation landmarks named distinctively when there is more than one (for example Primary, Footer, Breadcrumb), exactly one main, one contentinfo. Any `region` or `aside` is named. No empty or redundant landmark.                                                |        |       |
| R-03 | Heading structure                       | 1.3.1, 2.4.6        | List headings (NVDA: Elements List or H key; VoiceOver: rotor Headings; TalkBack: Headings).            | One `h1` that names the page, then a logical outline with no meaningful level skips; headings describe their sections; none is used only for styling; order matches the visual order.                                                                                           |        |       |
| R-04 | Skip link announcement                  | 2.4.1               | Press Tab on load and Enter on the skip link.                                                           | The link is announced with its name and role; after activation reading starts at the main content, not the header.                                                                                                                                                              |        |       |
| R-05 | Link purpose                            | 2.4.4, 4.1.2        | List links (NVDA: Elements List; VoiceOver: rotor Links; TalkBack: Links) and read them out of context. | Each link name makes sense alone or with its context. No bare "Read more" or "Learn more" without a distinguishing accessible name. Links to files or other sites say so. Repeated card links have unique names.                                                                |        |       |
| R-06 | Navigation semantics and state          | 4.1.2, 1.3.1        | Move through the header navigation and the mobile Menu.                                                 | The current page is announced (`aria-current`). Expandable items announce expanded or collapsed. Menus are lists of links. The Menu control announces its name and state.                                                                                                       |        |       |
| R-07 | Lists, tables, definition lists         | 1.3.1               | Move through lists and tables (NVDA: L and T keys).                                                     | Lists announce item counts. Data tables have captions and header cells and read with the right headers. Layout does not use tables. Definition lists read as term and definition.                                                                                               |        |       |
| R-08 | Images and graphics                     | 1.1.1               | Move through all images, icons and diagrams (NVDA: G key; VoiceOver: rotor Images).                     | Informative images have accurate, concise alternatives; decorative images and icons are silent; diagrams have a text alternative or adjacent explanation; no file names are read. Fixture images may be placeholders: judge the mechanism.                                      |        |       |
| R-09 | Buttons and controls: name, role, state | 4.1.2               | Tab to each button, disclosure and carousel control with a screen reader running.                       | Each announces a meaningful name, the correct role and its state (expanded, disabled, pressed).                                                                                                                                                                                 |        |       |
| R-10 | Carousel announcements                  | 4.1.2, 1.3.1, 4.1.3 | Reach the carousel with a screen reader and page through it.                                            | It is announced as a carousel or group with its label (the section name) and a list with a known item count; previous and next buttons are named and their disabled state is announced at each end; no live region chatters on scroll; paging does not move focus unexpectedly. |        |       |
| R-11 | Status messages and live regions        | 4.1.3               | Trigger any status message (form progress, success receipt, draft ribbon).                              | The message is announced without moving focus, once, politely (`role="status"`) and is not repeated. Blocking errors are announced assertively (`role="alert"`).                                                                                                                |        |       |
| R-12 | Reading order and hidden content        | 1.3.2, 4.1.2        | Read the page top to bottom in browse mode or by swiping. Compare with the visual order.                | Order matches. Closed menus and collapsed panels are not read. Visually hidden text is meaningful and not duplicated. Decorative content is silent.                                                                                                                             |        |       |
| R-13 | Page changes and navigation             | 2.4.2, 2.4.3, 3.2.3 | Follow a link, press Back, and use any in-page anchor links.                                            | The new page title is announced and reading restarts at the top (or the anchor target). No focus is left on a removed element.                                                                                                                                                  |        |       |
| R-14 | Consistent navigation and help          | 3.2.3, 3.2.4, 3.2.6 | Compare header, footer and the Talk to Vitalos call to action across several templates.                 | Items appear in the same order and relative place; the contact route is available in the same place on every page.                                                                                                                                                              |        |       |
| R-15 | Plain language and descriptive text     | 3.1.3, 3.1.4, 2.4.6 | Read the first screen of each template.                                                                 | Language is clear; unusual terms or abbreviations are explained near first use; heading and link text is descriptive.                                                                                                                                                           |        |       |

### 4.9 Running the common checks across templates

Run sections 4.1 to 4.8 in full on the home page and the contact page. On every other template run at least this minimum set: K-01 to K-08, K-15, Z-01, Z-03, T-01, M-01, M-03, C-01, C-02, S-01, R-01 to R-05, R-07 to R-09 and R-12. The header, with its mega-menu and mobile navigation (K-09 to K-12, Z-04, R-06), is shared by every template; run those rows once in full on the home page and spot-check on two other templates. Run K-13, P-01 and R-10 wherever a carousel appears.

Record the outcome per template here (`P` pass, `F` fail with an issue number, `-` not run). Add rows as templates are added.

| Template | Keyboard (K) | Zoom and reflow (Z) | Text spacing (T) | Motion and no-JS (M) | Contrast (C) | Target size (S) | Screen reader (R) | Notes |
| -------- | ------------ | ------------------- | ---------------- | -------------------- | ------------ | --------------- | ----------------- | ----- |
| HOME     |              |                     |                  |                      |              |                 |                   |       |
| WWD      |              |                     |                  |                      |              |                 |                   |       |
| PRAC     |              |                     |                  |                      |              |                 |                   |       |
| SOLX     |              |                     |                  |                      |              |                 |                   |       |
| SOL      |              |                     |                  |                      |              |                 |                   |       |
| OFFX     |              |                     |                  |                      |              |                 |                   |       |
| OFF      |              |                     |                  |                      |              |                 |                   |       |
| INDX     |              |                     |                  |                      |              |                 |                   |       |
| IND      |              |                     |                  |                      |              |                 |                   |       |
| HWW      |              |                     |                  |                      |              |                 |                   |       |
| WRKX     |              |                     |                  |                      |              |                 |                   |       |
| CASE     |              |                     |                  |                      |              |                 |                   |       |
| INSX     |              |                     |                  |                      |              |                 |                   |       |
| ART      |              |                     |                  |                      |              |                 |                   |       |
| PPL      |              |                     |                  |                      |              |                 |                   |       |
| LEAD     |              |                     |                  |                      |              |                 |                   |       |
| LABX     |              |                     |                  |                      |              |                 |                   |       |
| LABT     |              |                     |                  |                      |              |                 |                   |       |
| LABA     |              |                     |                  |                      |              |                 |                   |       |
| TRSX     |              |                     |                  |                      |              |                 |                   |       |
| TRS      |              |                     |                  |                      |              |                 |                   |       |
| ABT      |              |                     |                  |                      |              |                 |                   |       |
| CARX     |              |                     |                  |                      |              |                 |                   |       |
| CAR      |              |                     |                  |                      |              |                 |                   |       |
| CT       |              |                     |                  |                      |              |                 |                   |       |
| LGL      |              |                     |                  |                      |              |                 |                   |       |
| 404      |              |                     |                  |                      |              |                 |                   |       |

## 5. Template-specific checks

Each table adds checks specific to that template to the common checks in section 4. Run at 1440px and 390px with keyboard and at least one screen reader from 2.2 (NVDA with Firefox is the primary). On every template except the home page, confirm only that the header and footer are unchanged and that the current section carries `aria-current`; the full header and footer audit is done on the home page.

### 5.1 Home (HOME)

URL: `/`. Carries the header and footer audit, the hero, the section sequence and, in the full fixtures, a carousel.

| ID      | Check                                    | WCAG 2.2 SC                | Steps                                                                                                                           | Expected result                                                                                                                                            | Result | Notes |
| ------- | ---------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| HOME-01 | Header and footer in full                | 2.4.1, 2.4.5, 3.2.3, 4.1.2 | Run K-09 to K-12, Z-04 and R-06 on the header, then Tab through the footer. Check the footer navigation name and link purposes. | Header and footer pass. The footer is a `contentinfo` landmark with a named navigation. The Talk to Vitalos call to action is reachable at every viewport. |        |       |
| HOME-02 | Hero: one h1, descriptor and actions     | 1.3.1, 2.4.6, 2.5.3        | Read the hero with a screen reader and Tab to each hero action.                                                                 | One `h1`. Any decorative plane or panel is silent. Actions are named by their visible text.                                                                |        |       |
| HOME-03 | Hero over the decorative plane: contrast | 1.4.3, 1.4.11              | Sample hero text and button borders over the angled plane and gradient at 1440px and 390px.                                     | Text 4.5:1 and borders 3:1 at the worst point.                                                                                                             |        |       |
| HOME-04 | Section headings and regions             | 1.3.1, 2.4.6               | List headings and regions.                                                                                                      | One `h1`, then an `h2` per section; heading order matches the visual order; any named region is named sensibly.                                            |        |       |
| HOME-05 | Carousel                                 | 2.1.1, 2.2.2, 2.5.7, 4.1.2 | Run K-13, P-01, R-10 and M-02 on the carousel at 1440px and at 390px.                                                           | Passes those rows; at 390px it is a vertical list.                                                                                                         |        |       |
| HOME-06 | Reveal and count-up effects              | 2.2.2, 1.3.1               | Scroll with motion on, then with reduced motion and with JavaScript off. Check any figure that counts up.                       | With motion off or JavaScript off, figures show their final value at first paint. A screen reader reads the final value, not intermediate numbers.         |        |       |
| HOME-07 | In-page anchor navigation (if present)   | 2.4.5, 2.4.11              | Activate each anchor link by keyboard.                                                                                          | The target is visible below the sticky header, announced, and focus is not obscured.                                                                       |        |       |
| HOME-08 | Empty-state home (empty source)          | 1.3.1, 3.3.2               | Under the `empty` source view the page.                                                                                         | Locked copy only; no empty headings, regions or links.                                                                                                     |        |       |

### 5.2 What We Do index (WWD)

URL: `/what-we-do`. Hub for practices, solutions and offers.

| ID     | Check                | WCAG 2.2 SC  | Steps                                             | Expected result                                                                    | Result | Notes |
| ------ | -------------------- | ------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ | ----- |
| WWD-01 | Card links and names | 2.4.4, 1.3.1 | List links.                                       | Unique link names; no card contains duplicate links to the same target read twice. |        |       |
| WWD-02 | Mega-menu parity     | 2.4.5, 3.2.3 | Compare the mega-menu destinations with the page. | Every mega-menu destination is also reachable from the page body or footer.        |        |       |
| WWD-03 | Heading hierarchy    | 1.3.1        | List headings.                                    | `h1`, then an `h2` per group, `h3` per card where cards have headings.             |        |       |

### 5.3 Practice (PRAC)

URL: `/what-we-do/example-practice`. Proposition, problems, capabilities, body, related content and FAQ.

| ID      | Check                        | WCAG 2.2 SC                  | Steps                                                                              | Expected result                                                                            | Result | Notes |
| ------- | ---------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ | ----- |
| PRAC-01 | FAQ disclosures              | 4.1.2, 2.1.1                 | Run K-14 on the FAQ, then open and close an item with a screen reader.             | State announced; Enter and Space work; collapsed answers are not read.                     |        |       |
| PRAC-02 | Capability and problem lists | 1.3.1                        | Move through the lists with a screen reader.                                       | Real lists with item counts; no visual-only bullets.                                       |        |       |
| PRAC-03 | Related content rail         | 2.1.1, 4.1.2                 | If shown as a carousel run K-13 and R-10; otherwise confirm it is a list of links. | Passes the carousel rows, or a list with unique link names.                                |        |       |
| PRAC-04 | Breadcrumb                   | 1.3.1, 2.4.8 (AAA; guidance) | Read the breadcrumb navigation.                                                    | A named navigation landmark; the last item is the current page with `aria-current="page"`. |        |       |
| PRAC-05 | Calls to action              | 2.4.4, 2.5.8                 | Check CTA text and target size at 390px.                                           | CTAs are named by their text and are at least 24 by 24 CSS px.                             |        |       |

### 5.4 Solutions index (SOLX)

URL: `/solutions`. List of solutions.

| ID      | Check                                   | WCAG 2.2 SC         | Steps                                             | Expected result                                                                      | Result | Notes |
| ------- | --------------------------------------- | ------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ----- |
| SOLX-01 | Card or list semantics                  | 1.3.1, 2.4.4        | List links and headings.                          | One link per card with a unique name; list semantics with an item count.             |        |       |
| SOLX-02 | Filtering or grouping controls (if any) | 3.3.2, 4.1.2, 4.1.3 | Operate any filter by keyboard and screen reader. | Labelled controls; result changes announced politely; no change of context on input. |        |       |

### 5.5 Solution (SOL)

URL: `/solutions/example-solution`. Problem, signals, impact, approach, phases and FAQ.

| ID     | Check                        | WCAG 2.2 SC  | Steps                                                                                       | Expected result                                                                                    | Result | Notes |
| ------ | ---------------------------- | ------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------ | ----- |
| SOL-01 | Phases                       | 1.3.1, 1.3.2 | Read the phase sequence with a screen reader and look at any numbered or connector visuals. | Ordered steps are an ordered list or have numbered headings; connectors are decorative and silent. |        |       |
| SOL-02 | Signals and impact figures   | 1.1.1, 1.4.1 | Check any stat or signal blocks.                                                            | Values and labels are programmatically associated; meaning is not by colour alone.                 |        |       |
| SOL-03 | FAQ disclosures              | 4.1.2, 2.1.1 | Run K-14.                                                                                   | Passes.                                                                                            |        |       |
| SOL-04 | Process diagram (if present) | 1.1.1        | Read its text alternative.                                                                  | A concise alternative or an adjacent explanation.                                                  |        |       |

### 5.6 Offers index (OFFX)

URL: `/offers`. List of offers.

| ID      | Check       | WCAG 2.2 SC  | Steps                                   | Expected result                                  | Result | Notes |
| ------- | ----------- | ------------ | --------------------------------------- | ------------------------------------------------ | ------ | ----- |
| OFFX-01 | Offer cards | 2.4.4, 1.3.1 | List links and headings.                | Unique link names.                               |        |       |
| OFFX-02 | Empty state | 1.3.1        | Under the `empty` source view the page. | An honest empty message; no empty list landmark. |        |       |

### 5.7 Offer (OFF)

URL: `/offers/example-offer`. Offer detail with a call to action leading to the contact form.

| ID     | Check                            | WCAG 2.2 SC   | Steps                                                                | Expected result                                                                                                            | Result | Notes |
| ------ | -------------------------------- | ------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| OFF-01 | Offer to contact journey         | 2.4.4, 3.2.3  | Activate the CTA by keyboard and check the contact page.             | The CTA names its destination; the contact page opens with the topic preselected (CT-21).                                  |        |       |
| OFF-02 | Definition and evaluation tables | 1.3.1, 1.4.10 | Move through any table or definition list at 390px and at 400% zoom. | Captions and headers present; responsive stacking keeps headers associated; any overflow scrolls inside its own container. |        |       |
| OFF-03 | Inclusions and exclusions        | 1.3.1, 1.4.1  | Check any tick or cross icons.                                       | Meaning is conveyed in text; icons are decorative or labelled.                                                             |        |       |

### 5.8 Industries index (INDX)

URL: `/industries`. Shown only when the Industries gate is open.

| ID      | Check                 | WCAG 2.2 SC  | Steps                                    | Expected result                                             | Result | Notes |
| ------- | --------------------- | ------------ | ---------------------------------------- | ----------------------------------------------------------- | ------ | ----- |
| INDX-01 | Carousel or grid      | 2.1.1, 4.1.2 | If a carousel is used run K-13 and R-10. | Passes the carousel rows; at 390px a vertical list.         |        |       |
| INDX-02 | Gate closed behaviour | 3.2.3        | With the sparse set request the URL.     | The 404 template appears and no navigation item links here. |        |       |

### 5.9 Industry (IND)

URL: `/industries/example-industry`. Industry detail.

| ID     | Check               | WCAG 2.2 SC | Steps                                        | Expected result                                                                         | Result | Notes |
| ------ | ------------------- | ----------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | ------ | ----- |
| IND-01 | Consideration lists | 1.3.1       | Move through the lists with a screen reader. | Real lists; nothing reads as a certification claim that the page does not substantiate. |        |       |
| IND-02 | Related links       | 2.4.4       | List links.                                  | Descriptive link names.                                                                 |        |       |

### 5.10 How we work (HWW)

URL: `/how-we-work`. Stage descriptions and process.

| ID     | Check                       | WCAG 2.2 SC    | Steps                                                                    | Expected result                                                                                 | Result | Notes |
| ------ | --------------------------- | -------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------ | ----- |
| HWW-01 | Stage sequence              | 1.3.1, 1.3.2   | Read the stages with a screen reader; check numbering and connectors.    | Ordered semantics; connectors decorative; reading order equals visual order.                    |        |       |
| HWW-02 | Connector drawing animation | 2.2.2, 2.3.3   | Reload with motion allowed, then with reduced motion and JavaScript off. | Connectors appear in their final state without motion; no information depends on the animation. |        |       |
| HWW-03 | Dense content at zoom       | 1.4.10, 1.4.12 | Run Z-03 and T-01 on this page.                                          | No clipped stage text; stages stack to one column at 320px.                                     |        |       |

### 5.11 Work index (WRKX)

URL: `/work`. Shown only when the Work gate is open.

| ID      | Check                    | WCAG 2.2 SC         | Steps                                                                | Expected result                                                                                                  | Result | Notes |
| ------- | ------------------------ | ------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| WRKX-01 | List and filter controls | 3.3.2, 4.1.2, 4.1.3 | If filtering exists, filter and clear by keyboard and screen reader. | Controls are labelled; the result count is announced politely; focus is not lost; no change of context on input. |        |       |
| WRKX-02 | Card imagery             | 1.1.1               | Check images in cards.                                               | Informative images have alternatives; decorative images are silent.                                              |        |       |

### 5.12 Case study (CASE)

URL: `/work/example-case-study`. Evidence-based narrative, metrics, quotes and approvals.

| ID      | Check                       | WCAG 2.2 SC          | Steps                                                             | Expected result                                                                                                                        | Result | Notes |
| ------- | --------------------------- | -------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| CASE-01 | Metrics and charts          | 1.1.1, 1.4.1, 1.4.11 | Check every chart, stat and table: labels, colours, alternatives. | Each chart has a text alternative or data table; labels sit on the data; series are distinguishable without colour.                    |        |       |
| CASE-02 | Quotations and attributions | 1.3.1                | Move through a quotation with a screen reader.                    | Marked up as a quotation with its attribution read in order.                                                                           |        |       |
| CASE-03 | Rich text, tables and code  | 1.3.1, 1.4.10        | Check headings, lists, code blocks and data tables in the body.   | Headings in order; tables captioned; code blocks are copyable and, if they overflow, keyboard-scrollable and do not break page reflow. |        |       |
| CASE-04 | Long-form reading           | 1.4.12, 1.4.4        | Read a long section at 200% zoom and with text spacing.           | Line length and spacing remain comfortable; nothing is clipped.                                                                        |        |       |

### 5.13 Insights index (INSX)

URL: `/insights`. Shown only when the Insights gate is open.

| ID      | Check                            | WCAG 2.2 SC         | Steps                                          | Expected result                                                                                           | Result | Notes |
| ------- | -------------------------------- | ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ | ----- |
| INSX-01 | Filter and sort controls         | 3.3.2, 4.1.2, 4.1.3 | Use the filters by keyboard and screen reader. | Labelled; results changes announced politely; result count exposed; clear and reset operable by keyboard. |        |       |
| INSX-02 | Pagination or load more (if any) | 2.4.4, 4.1.2, 2.4.3 | Page forward and back.                         | Current page announced; focus managed after activation; links named by page or action.                    |        |       |
| INSX-03 | Dates and metadata               | 1.3.1               | Read an article card.                          | Dates are unambiguous and read sensibly.                                                                  |        |       |

### 5.14 Article (ART)

URL: `/insights/example-insight-1`. Long-form article (headings, lists, quotes, code, callouts).

| ID     | Check                            | WCAG 2.2 SC          | Steps                                                        | Expected result                                                                                                                     | Result | Notes |
| ------ | -------------------------------- | -------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| ART-01 | Heading outline of the body      | 1.3.1, 2.4.6         | List headings.                                               | `h1`, then `h2` and `h3` without level skips; body headings do not duplicate the page `h1`.                                         |        |       |
| ART-02 | Code blocks                      | 1.4.10, 2.1.1, 1.4.3 | Tab to a code block and scroll it by keyboard; zoom to 400%. | A scrollable code block is keyboard-focusable with an accessible name; the page does not scroll sideways; code colours reach 4.5:1. |        |       |
| ART-03 | Callouts, pull quotes and tables | 1.3.1, 1.4.1         | Move through each with a screen reader.                      | Role and meaning are conveyed in text, not colour; tables captioned.                                                                |        |       |
| ART-04 | Author and related links         | 2.4.4                | List links in the byline and related content.                | The author link names the person; related links are unique and descriptive.                                                         |        |       |
| ART-05 | Anchor navigation (if present)   | 2.4.5, 2.4.11        | Use any in-page contents links.                              | The target heading is visible below the sticky header and announced.                                                                |        |       |

### 5.15 Person profile (PPL)

URL: `/people/example-person`. Individual profile.

| ID     | Check                         | WCAG 2.2 SC  | Steps                                      | Expected result                                                                               | Result | Notes |
| ------ | ----------------------------- | ------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------- | ------ | ----- |
| PPL-01 | Portrait and alternative text | 1.1.1        | Inspect the portrait with a screen reader. | The alternative is the person's name, or empty where the name is adjacent; never a file name. |        |       |
| PPL-02 | Contact or social links       | 2.4.4, 2.5.8 | List links and measure targets at 390px.   | Link names state the destination; targets are at least 24px.                                  |        |       |

### 5.16 Leadership (LEAD)

URL: `/about/leadership`. People list.

| ID      | Check        | WCAG 2.2 SC  | Steps                            | Expected result                                                                      | Result | Notes |
| ------- | ------------ | ------------ | -------------------------------- | ------------------------------------------------------------------------------------ | ------ | ----- |
| LEAD-01 | People cards | 1.3.1, 2.4.4 | List links and headings.         | One link per person named with the person's name; list semantics with an item count. |        |       |
| LEAD-02 | Portraits    | 1.1.1        | Check all portrait alternatives. | As PPL-01.                                                                           |        |       |

### 5.17 Labs index (LABX)

URL: `/labs`. Shown only when the Labs gate is open.

| ID      | Check                       | WCAG 2.2 SC  | Steps                   | Expected result                                  | Result | Notes |
| ------- | --------------------------- | ------------ | ----------------------- | ------------------------------------------------ | ------ | ----- |
| LABX-01 | Type navigation             | 2.4.4, 1.3.1 | Read the list of types. | A list or named navigation; links name the type. |        |       |
| LABX-02 | Asset cards and status tags | 1.4.1, 1.3.1 | Check any status tags.  | Status is conveyed in text, not colour alone.    |        |       |

### 5.18 Labs type (LABT)

URL: `/labs/open-source`. Category page; it is not in the sitemap by design.

| ID      | Check                  | WCAG 2.2 SC                  | Steps                | Expected result                               | Result | Notes |
| ------- | ---------------------- | ---------------------------- | -------------------- | --------------------------------------------- | ------ | ----- |
| LABT-01 | Breadcrumb and context | 1.3.1, 2.4.8 (AAA; guidance) | Read the breadcrumb. | A named landmark; the current page is marked. |        |       |
| LABT-02 | Asset list             | 1.3.1, 2.4.4                 | List links.          | Unique, descriptive link names.               |        |       |

### 5.19 Lab asset (LABA)

URL: `/labs/open-source/example-open-source-tool`. Asset detail (repository, licence, status).

| ID      | Check                    | WCAG 2.2 SC   | Steps                           | Expected result                                                                        | Result | Notes |
| ------- | ------------------------ | ------------- | ------------------------------- | -------------------------------------------------------------------------------------- | ------ | ----- |
| LABA-01 | Metadata                 | 1.3.1         | Move through the metadata.      | Term and value pairs read as definitions.                                              |        |       |
| LABA-02 | External links           | 2.4.4         | List links that leave the site. | External links are named and indicated; opening in a new window, if any, is announced. |        |       |
| LABA-03 | Code or install snippets | 1.4.10, 2.1.1 | As the ART code block row.      | Passes.                                                                                |        |       |

### 5.20 Trust overview (TRSX)

URL: `/trust`. Trust Centre overview and topic links.

| ID      | Check                           | WCAG 2.2 SC  | Steps                                    | Expected result                                                                                        | Result | Notes |
| ------- | ------------------------------- | ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ | ----- |
| TRSX-01 | Topic cards                     | 2.4.4, 1.3.1 | List links and headings.                 | One clear link per topic; no wording reads as a certification claim the site does not substantiate.    |        |       |
| TRSX-02 | Evidence request route          | 3.2.6, 2.4.4 | Follow the route that requests evidence. | The contact route is clearly named; the contact page opens with the topic preselected.                 |        |       |
| TRSX-03 | Accessibility statement wording | 3.3.2        | Read any accessibility statement text.   | It matches the real outcome of this audit and makes no conformance claim that has not been signed off. |        |       |

### 5.21 Trust topic (TRS)

URL: `/trust/security`. Topic detail.

| ID     | Check                        | WCAG 2.2 SC | Steps                      | Expected result                                         | Result | Notes |
| ------ | ---------------------------- | ----------- | -------------------------- | ------------------------------------------------------- | ------ | ----- |
| TRS-01 | Evidence and claim lists     | 1.3.1       | Read the lists and tables. | Real lists and captioned tables; status words in text.  |        |       |
| TRS-02 | Updated and version metadata | 1.3.1       | Read the date metadata.    | Machine-readable `time` where used; announced sensibly. |        |       |

### 5.22 About (ABT)

URL: `/about`. About Vitalos.

| ID     | Check                           | WCAG 2.2 SC | Steps          | Expected result         | Result | Notes |
| ------ | ------------------------------- | ----------- | -------------- | ----------------------- | ------ | ----- |
| ABT-01 | Section headings                | 1.3.1       | List headings. | Logical outline.        |        |       |
| ABT-02 | Links to leadership and careers | 2.4.4       | List links.    | Descriptive link names. |        |       |

### 5.23 Careers index (CARX)

URL: `/careers`. Shown only when the Careers gate is open. Closed or expired roles must not appear.

| ID      | Check                             | WCAG 2.2 SC  | Steps                                                                                       | Expected result                                                                             | Result | Notes |
| ------- | --------------------------------- | ------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ | ----- |
| CARX-01 | Role rows                         | 1.3.1, 2.4.4 | List links and read a row.                                                                  | The role title is the link name; location and type read as supporting text; list semantics. |        |       |
| CARX-02 | Equal opportunity and adjustments | 3.3.2        | Read any equal-opportunity or accessibility statement and the route to request adjustments. | Plain language; a contact route for adjustments is available.                               |        |       |

### 5.24 Role (CAR)

URL: `/careers/example-role`. Individual job page.

| ID     | Check                  | WCAG 2.2 SC  | Steps                               | Expected result                                            | Result | Notes |
| ------ | ---------------------- | ------------ | ----------------------------------- | ---------------------------------------------------------- | ------ | ----- |
| CAR-01 | Structured job content | 1.3.1        | List headings and lists.            | Headings and lists in order.                               |        |       |
| CAR-02 | Apply route            | 2.4.4, 3.3.2 | Follow the apply route by keyboard. | A labelled link or button; any form follows the CT checks. |        |       |

### 5.25 Legal (LGL)

URL: `/legal/privacy`. Legal text rendered from rich text (content is the owner's).

| ID     | Check                        | WCAG 2.2 SC          | Steps                                 | Expected result                                                                          | Result | Notes |
| ------ | ---------------------------- | -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- | ------ | ----- |
| LGL-01 | Long rich text               | 1.3.1, 2.4.6, 1.4.12 | List headings and apply text spacing. | Logical hierarchy; numbered sections are real lists or headings; no clipping under T-01. |        |       |
| LGL-02 | Tables (for example cookies) | 1.3.1, 1.4.10        | Move through any table at 390px.      | Captioned, headers associated, responsive or scrollable inside its own container.        |        |       |
| LGL-03 | Version and effective date   | 1.3.1                | Read the version metadata.            | Present and read in order.                                                               |        |       |

### 5.26 Not found (404)

URL: `/this-page-does-not-exist`. Status 404 and `noindex`; also what a closed gate shows.

| ID     | Check                     | WCAG 2.2 SC  | Steps                                                           | Expected result                                                                                                                                                           | Result | Notes |
| ------ | ------------------------- | ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| 404-01 | Orientation               | 2.4.2, 2.4.6 | Load the page and read the title and `h1` with a screen reader. | Title and `h1` state that the page was not found; a single `h1`; one `main`.                                                                                              |        |       |
| 404-02 | Way out                   | 2.4.4, 3.2.3 | Tab through the page.                                           | Clear links onwards (home, contact, navigation); the skip link works.                                                                                                     |        |       |
| 404-03 | Header and footer present | 1.3.1, 3.2.3 | Compare with other templates.                                   | The header and footer match the rest of the site; if missing, record a consistent-navigation failure (handoff task 4.2 plans to move the 404 into the site layout group). |        |       |

### 5.27 Contact, including enquiry form errors, success and Turnstile (CT)

URL: `/contact`. Run with the full fixtures, in-memory backend and Turnstile test keys (2.3) so the form renders; then run the gated state (no privacy notice, or the `empty` source), which shows an email alternative instead of a form. Use only Cloudflare's documented test keys. Do not try to defeat or automate the security check. Trigger every error yourself by leaving fields empty or invalid.

| ID    | Check                                       | WCAG 2.2 SC                | Steps                                                                                     | Expected result                                                                                                                                                                                                                 | Result | Notes |
| ----- | ------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| CT-01 | Heading and intent routes                   | 1.3.1, 2.4.6               | Read the heading and the routes beside the form with a screen reader.                     | One `h1`; route links are named by their purpose; the page makes sense before the form.                                                                                                                                         |        |       |
| CT-02 | Form has an accessible name                 | 1.3.1, 4.1.2               | List landmarks and forms, then Tab into the form.                                         | The form is named (for example Enquiry) and its fields are sensibly grouped.                                                                                                                                                    |        |       |
| CT-03 | Every field has a visible, associated label | 1.3.1, 3.3.2, 4.1.2, 2.5.3 | Tab through each field and read the announcement; inspect the accessibility tree.         | Each field announces its label, role, required state and any hint text. Labels persist when a field has a value or an error. Placeholder text is never the only label.                                                          |        |       |
| CT-04 | Autocomplete and input types                | 1.3.5, 3.3.2               | Inspect the name, email and organisation fields; on a phone check the keyboard shown.     | Appropriate `autocomplete` tokens and input types; mobile keyboards match.                                                                                                                                                      |        |       |
| CT-05 | Required and optional fields                | 3.3.2                      | Read the form instructions.                                                               | Required fields are indicated in text, not colour alone; instructions come before the fields.                                                                                                                                   |        |       |
| CT-06 | Consent and privacy notice link             | 3.3.2, 2.4.4, 2.5.8        | Reach the consent checkbox and its notice link.                                           | The checkbox label includes the notice link; the link is named as the privacy notice; target size passes.                                                                                                                       |        |       |
| CT-07 | Honeypot is invisible to everyone           | 1.3.1, 2.4.3               | Tab through the form and browse with a screen reader.                                     | The honeypot field is not reachable by Tab and is not read.                                                                                                                                                                     |        |       |
| CT-08 | Turnstile presence and focus                | 2.1.2, 2.4.11              | Where a visible widget appears, reach it by keyboard and leave it forwards and backwards. | The widget does not trap focus, does not obscure focused content and is not the only way to contact Vitalos (the email alternative remains). Record Cloudflare's behaviour; do not log Cloudflare's own document as our defect. |        |       |
| CT-09 | Accessible authentication                   | 3.3.8                      | Complete and submit the form with keyboard only, then with a screen reader.               | No cognitive function test (puzzle, transcription) is required. If a challenge appears an alternative method exists. Spam prevention creates no inaccessible puzzle.                                                            |        |       |
| CT-10 | Turnstile unavailable                       | 3.3.1, 4.1.3               | Block `challenges.cloudflare.com` with a content blocker and submit.                      | A clear message says the security check did not complete and what to do; it is announced; the email alternative is offered; entered values are kept.                                                                            |        |       |
| CT-11 | Empty submission: error summary             | 3.3.1, 3.3.3, 4.1.3, 2.4.3 | Press Send enquiry with required fields empty (keyboard only, then with a screen reader). | An error summary takes focus and is announced (for example "check the highlighted fields"); it lists each problem as a link; a screen reader reads the heading and the list.                                                    |        |       |
| CT-12 | Error summary links                         | 2.4.3, 2.4.11, 3.3.1       | Activate each link in the summary by keyboard.                                            | Focus moves to the matching field, visible and not obscured by the sticky header.                                                                                                                                               |        |       |
| CT-13 | Inline errors                               | 3.3.1, 1.4.1, 1.3.1, 4.1.2 | Tab to each invalid field with a screen reader.                                           | The error text is read with the field; the field is marked invalid; the error is not shown by colour alone and says what is wrong in text.                                                                                      |        |       |
| CT-14 | Error suggestions                           | 3.3.3                      | Enter an invalid email address and, if limits exist, an over-long or too-short value.     | The message explains how to correct the input, not only that it failed.                                                                                                                                                         |        |       |
| CT-15 | Values preserved                            | 3.3.7                      | After the error state inspect each field.                                                 | Entered values remain; the user is not made to re-enter information.                                                                                                                                                            |        |       |
| CT-16 | No-JavaScript validation                    | 3.3.1, 4.1.3               | Disable JavaScript and submit empty.                                                      | Server-rendered errors with the same summary, associations and focus target.                                                                                                                                                    |        |       |
| CT-17 | Success state and reference                 | 4.1.3, 2.4.3, 3.3.4        | Submit a valid enquiry (fixture backend, test key) and observe with a screen reader.      | A neutral receipt with the reference appears and is announced as a status (or receives focus deliberately); the reference is readable and copyable; the page says what happens next without over-promising.                     |        |       |
| CT-18 | Submission progress                         | 4.1.3, 2.2.1               | Submit and watch the button and status.                                                   | The pending state is announced politely; the button cannot be activated twice; nothing times out while the user is typing.                                                                                                      |        |       |
| CT-19 | Form at zoom, 320px and text spacing        | 1.4.4, 1.4.10, 1.4.12      | Run Z-01, Z-03 and T-01 on the form, including with error messages shown.                 | Fields, labels and errors stay visible and associated; no overlap; no page-level horizontal scroll (known regression area: `/contact` at 320px, handoff task 4.1).                                                              |        |       |
| CT-20 | Gated state (no form)                       | 1.3.1, 2.4.4               | View the page without a published privacy notice or storage.                              | One `h1` and an honest email alternative; the email link is clearly named; no Turnstile script loads.                                                                                                                           |        |       |
| CT-21 | Intent, offer and campaign parameters       | 3.3.2, 1.3.1               | Open `/contact?intent=` and `/contact?offer=` URLs from the site.                         | The topic is preselected and announced with its field; tracking values are neither shown nor read out.                                                                                                                          |        |       |

## 6. Screen reader session record

For each pair in 2.2 complete one row. Record the commands you used so the run is reproducible.

| Pair                           | Version(s) | Templates covered | Landmarks and headings (R-02, R-03) | Forms (CT) | Carousel (R-10) | Notes |
| ------------------------------ | ---------- | ----------------- | ----------------------------------- | ---------- | --------------- | ----- |
| NVDA with Firefox (Windows)    |            |                   |                                     |            |                 |       |
| VoiceOver with Safari (macOS)  |            |                   |                                     |            |                 |       |
| VoiceOver with Safari (iOS)    |            |                   |                                     |            |                 |       |
| TalkBack with Chrome (Android) |            |                   |                                     |            |                 |       |

Coverage guidance: every template with NVDA and Firefox; at least the home page, one practice, the contact form (including errors and success), one article and the Trust overview with each of the other three. Record anything not covered as `Blocked` rather than leaving it blank.

## 7. Cross-template concerns

Record against the nearest template and cite the common check.

- Consistent order and identification of the header, footer and call to action (SC 3.2.3, 3.2.4, 3.2.6).
- Any banner, ribbon (including the draft ribbon from the `draft` source), cookie notice or contact widget that overlays content and obscures focus (SC 2.4.11; Stage 9 section 30).
- Any time limit, auto-updating or auto-advancing content (SC 2.2.1, 2.2.2). None is expected.
- Route transitions: after a client-side navigation the focus position and the announced page title are correct (SC 2.4.2, 2.4.3). Stage 9 forbids SPA-style transitions that interfere with navigation or accessibility.

## 8. What G5 needs

The audit run against the build proposed for launch; every `Fail` fixed and re-tested, or explicitly accepted in writing by the owner with its WCAG 2.2 AA impact stated; the automated accessibility suites green on the same build; and the public accessibility statement (Stage 8 section 24) worded to match the real outcome. No date bypasses a gate (`docs/delivery/launch-gates.md`): reduce scope rather than waive a failed criterion.

## 9. Issue-logging procedure

1. For each `Fail`, open a GitHub issue in `Isaacpyo/vitalos-platform` titled `A11y: <template code> <check ID> <short description>`, for example `A11y: CT CT-12 error summary link does not move focus to field`. Add an `accessibility` label if the repository has one; creating labels is a maintainer action.
2. Use this body:

```text
Check ID: (for example K-08 or CT-12)
Template and URL:
WCAG 2.2 SC: (for example 2.4.11 Focus Not Obscured, AA)
Severity: Blocker | Serious | Moderate | Minor
Build: commit SHA, content source, fixture set
Environment: OS, browser and version, assistive technology and version, device, viewport, zoom
Steps to reproduce:
Expected result (from this script):
Actual result:
Evidence: screenshot, recording or screen reader transcript (fixture data only; no personal data or secrets)
Suggested direction (optional):
```

3. Severity. Blocker: a user cannot complete a core task (navigate, read, contact Vitalos) with keyboard or assistive technology. Serious: the task is possible only with great difficulty or a workaround. Moderate: an AA criterion fails with a reasonable workaround. Minor: best practice or AAA guidance. Any Blocker, Serious or AA failure blocks G5.
4. Put the issue number in the Notes cell and set Result to `Fail`. Do not change the row until the fix is merged and the row re-run on a new build; then record the re-test result and date in Notes.
5. Fixes follow `AGENTS.md` and `docs/delivery/handoff-2026-10-10.md` section 2: one branch and pull request per fix, with a test where the failure can be automated (add it to `tests/accessibility` or the relevant end-to-end spec; never weaken an existing assertion).
6. A defect the automated suites should have caught is also a gap in the automated layer: add the check and update section 3.

## 10. Sign-off

Blank until an audit is performed. Nobody completes this block on another person's behalf. Nothing in this document records a completed audit.

| Field                                                                                  | Value |
| -------------------------------------------------------------------------------------- | ----- |
| Auditor (name and role)                                                                |       |
| Date started                                                                           |       |
| Date completed                                                                         |       |
| Build under test (commit SHA)                                                          |       |
| Content source and fixture set (`fixtures` full, `draft`, `repo` staging)              |       |
| URL or local run command used                                                          |       |
| Desktop OS and browsers, with versions                                                 |       |
| Screen readers, with versions (NVDA, VoiceOver macOS, VoiceOver iOS, TalkBack)         |       |
| Devices used (phone, tablet)                                                           |       |
| Automated suites run on the same build (`test:a11y`, `test:storybook-a11y`) and result |       |
| Templates covered (list; state any not covered and why)                                |       |
| Count of Pass, Fail, N/A, Blocked                                                      |       |
| Open issues (numbers and severity)                                                     |       |
| Accepted failures, if any (owner's written acceptance, reference)                      |       |
| Outcome (Not performed / Failed / Passed with accepted exceptions / Passed)            |       |
| G5 decision and decision maker                                                         |       |
| Signature or confirmation                                                              |       |
