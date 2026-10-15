# Section map: carrying the homepage across the site

Phase 0 of the pages redesign (`feat/pages-redesign`, 15 Oct 2026), updated to match what was built. Where the build differs from the first plan, the reason is in DECISIONS.md (rows 15 to 24). For every public route, the sections it has and the homepage pattern each one uses. Decisions and deviations are in [DECISIONS.md](DECISIONS.md); copy edits in [COPY-CHANGES.md](COPY-CHANGES.md); image slots in [IMAGE-SLOTS.md](IMAGE-SLOTS.md).

## The homepage patterns (baseline)

Baseline screenshots: `screenshots/baseline/home-{1440,768,390}.jpg`.

| #   | Homepage section            | Component (`@vitalos/ui` unless stated)                                                                                                    | Tone                                        | Imagery and icons                                           | Motion                                    | Copy structure                                                     |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| H1  | Hero                        | `Section` dark, pulled under the clear header, rounded bottom corners; `Display xl` h1, `Lead`, one secondary `Button`; `HeroVisual glass` | dark (photograph under a 72% black overlay) | owner photograph `/images/hero/cloud-infrastructure-*.webp` | drift, glints, panel loops; `MotionPause` | title, one-sentence lead, one CTA                                  |
| H2  | Problems we solve           | `Band` + `SolutionShowcase`                                                                                                                | light                                       | solution illustrations; solution icons                      | hover or focus presents an item           | eyebrow, title, link; numbered item titles plus a one-line summary |
| H3  | From strategy to production | dark `Section`, glow, `SectionHeading`, `Lead`, `Button`, `ProcessCycle`                                                                   | dark                                        | nine stage discs                                            | ring entrance                             | eyebrow, title, short intro, one CTA, nine stages                  |
| H4  | Five practices, one firm    | `Band` + `PracticeShowcase`                                                                                                                | muted                                       | practice illustrations; practice icons                      | tilt, cross-fade                          | eyebrow, title, link; items with summaries                         |
| H5  | Industries                  | dark `Section`, `AuroraBackdrop`, `MotionPause`, `IndustryShowcase`                                                                        | dark                                        | industry photographs; industry icons                        | aurora, expanding panels                  | eyebrow, title, link; items with summaries                         |
| H6  | Vitalos Labs                | `Band` + `LabShowcase`                                                                                                                     | light                                       | molecule diagram (SVG)                                      | CSS hover                                 | eyebrow, title, link; specimen cards with maturity                 |
| H7  | Closing                     | `TerminalCTA variant="feature"`                                                                                                            | light band, blue-to-midnight card           | rings, glow                                                 | Reveal                                    | title, one line, primary and secondary CTA                         |
| —   | Shared                      | `SectionHeading` (eyebrow, title, intro, link), `Reveal` staggers, `MobileReveal` fade on compact screens, tone alternation light/muted    |                                             | `Icon` (24 grid, 1.5 stroke, square caps), `IconTile`       |                                           |                                                                    |

Not rendered today (no approved content): credibility strip, selected work. The Insights and Careers bands (after Labs, before the closing band) come from the Super Admin and are hidden until those sections are opened (ADR-035).

## New shared patterns (Phase 1)

| Pattern                                     | Built from                                                                                                | Used for                                                                                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageHero` `tone="dark"` (full and compact) | H1: dark band under the clear header, the same photograph under a heavier overlay, rounded bottom corners | every page's first band. Full (`Display`) on top-level pages, compact (`title` size, shorter padding) on detail pages, optional media on the right |
| `FeatureGrid`                               | H2/H4 items: icon tile, short title, one line; 2, 3 or 4 columns; `cards` or `rows`                       | problems, signals, capabilities, outputs, requirements, realities, trust topics, onward links                                                      |
| Closing band (`TerminalCTA feature`)        | H7                                                                                                        | the end of every page, with the page's own primary action                                                                                          |
| Lifecycle band                              | H3 (`ProcessCycle` on a dark band)                                                                        | What We Do, How We Work                                                                                                                            |
| `MediaSlot` (`apps/web`)                    | H1/H5 imagery rules                                                                                       | detail-page heroes without an approved image: About, Labs assets, case studies, article covers                                                     |
| Principles                                  | H2 cards: the body's `h2` sections as title-and-line cards                                                | practice and solution bodies, About                                                                                                                |

## Route map

Sections in order. "→ Hn" names the homepage pattern each one carries.

### What We Do family

| Route                        | Sections                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/what-we-do`                | Hero full → H1 · Practices → H4 `PracticeShowcase` · Solutions → H2 `SolutionShowcase` · Offers → `FeatureGrid` cards with icons · From strategy to production → H3 · Closing → H7                                                                                                                                                                  |
| `/what-we-do/[practice]` (5) | Hero compact with the practice illustration → H1 · Problems → `FeatureGrid` · Capabilities → `FeatureGrid` rows · Principles (body sections) → H2 cards · Related solutions → H2 `SolutionShowcase` · Related offers → `FeatureGrid` · Industries → H5 (gated) · Selected work (gated, real content only) · Closing with the practice's action → H7 |
| `/solutions`                 | Hero full → H1 · Solutions → H2 `SolutionShowcase` · Closing → H7                                                                                                                                                                                                                                                                                   |
| `/solutions/[slug]` (6)      | Hero compact with the solution illustration → H1 · Signals → `FeatureGrid` · Impact and approach → principles · Typical journey → `ProcessJourney` on a dark band (H3 tone) · Related offers → `FeatureGrid` · Practices → H4 cards · Industries → H5 (gated) · Common questions (answers exempt) · Closing → H7                                    |
| `/offers`                    | Hero full → H1 · Offers → `FeatureGrid` cards with icons · Closing → H7                                                                                                                                                                                                                                                                             |
| `/offers/[slug]` (13)        | Hero compact with the offer icon and engagement facts → H1 · What you get, what we need, what is not included → `FeatureGrid` · Related solutions and practices → H2/H4 cards · Closing with "Discuss this offer" → H7                                                                                                                              |

### Industries family

| Route                    | Sections                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/industries`            | Hero full → H1 · Industries → H5 `IndustryShowcase` on the dark aurora band · Closing → H7                                                                                                                                                        |
| `/industries/[slug]` (4) | Hero compact with the industry photograph → H1 · Realities, problems, AI opportunities, considerations → `FeatureGrid` · Solutions → H2 `SolutionShowcase` · Offers → `FeatureGrid` · Work and insights (gated, real content only) · Closing → H7 |

### Work family (gated; no published case studies today)

| Route          | Sections                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/work`        | Hero full → H1 · Filter and case study rows (unchanged behaviour) · Closing → H7                                                                                       |
| `/work/[slug]` | Hero compact with `MediaSlot` `work.case-study.{slug}` → H1 · Stats, challenge, approach, outcome, testimonial (real content only) · Related → H2 cards · Closing → H7 |

### About and How We Work

| Route          | Sections                                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/about`       | Hero full with `MediaSlot` `about.hero` → H1 · Body sections → principles (H2 cards) · Explore → `FeatureGrid` with icons · Closing → H7                                                       |
| `/how-we-work` | Hero full → H1 · The lifecycle → H3 `ProcessCycle` dark band (titles and discs) · Ways to start, engagement lead, gates → H2 cards · Stage detail → `ProcessJourney` (anchored) · Closing → H7 |

### Insights and Labs

| Route                                                         | Sections                                                                                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/insights` (closed until opened in the Super Admin, ADR-035) | Hero full → H1 · Format tabs, topic links, featured card and `FeatureGrid`-style cards, pagination · Closing → H7                                              |
| `/insights/[slug]`                                            | Hero compact with the admin cover when there is one (no placeholder) → H1 · Article body (exempt) · Sources, editorial note · Authors · Related · Closing → H7 |
| `/labs`                                                       | Hero full → H1 · Maturity labels (body) as rows · Categories → `FeatureGrid` icon cards · Assets → the filterable list (unchanged behaviour) · Closing → H7    |
| `/labs/[type]`                                                | Hero compact → H1 · Assets → H6 `LabShowcase` · Closing → H7                                                                                                   |
| `/labs/[type]/[slug]`                                         | Hero compact with maturity and `MediaSlot` `labs.asset.{slug}` → H1 · Is / is not, body, limitations, resources (layout only) · Closing → H7                   |
| `/people/[slug]`                                              | Hero compact (person heading) → H1 · Credentials, insights · Closing → H7                                                                                      |

### Careers (closed until opened in the Super Admin, ADR-035)

| Route             | Sections                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/careers`        | Hero full with `MediaSlot` `careers.hero` → H1 · How we work (value cards) · Open roles by practice (rows) · Optional policy sections · Closing → H7 |
| `/careers/[slug]` | Hero compact with practice, facts and apply → H1 · Role sections and the application form (exempt); ends with its own apply action                   |

### Trust Centre

| Route                | Sections                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/trust`             | Hero full → H1 · Body · Topics → `FeatureGrid` cards with icons · Closing → H7 with the evidence request as its action |
| `/trust/[topic]` (6) | Hero compact → H1 · Policy text (exempt), certifications, subprocessors · Evidence request → H7-style card             |

### Contact, legal and the rest

| Route              | Source pattern | Sections                                                                                                                                       |
| ------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/contact`         | H1 + H7        | Hero compact ("Bring us the problem.") → contact facts beside the enquiry form in a raised card (form flow, Turnstile and analytics unchanged) |
| `/faq`             | H1 + H2        | Hero full → questions grouped by solution (answers exempt) → Closing → H7                                                                      |
| `/legal/[slug]`    | H1 compact     | Hero compact with the effective date → legal text (exempt)                                                                                     |
| 404 (`not-found`)  | H1 compact     | Hero compact with the two actions                                                                                                              |
| 500 (`error.tsx`)  | H1 compact     | Same as 404, "Try again" and contact                                                                                                           |
| `global-error.tsx` | none           | Unchanged: renders without the stylesheet by design                                                                                            |
