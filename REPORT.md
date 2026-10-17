# Report: product page template (17 Oct 2026)

Branch `feat/products-template`. The owner asked for the Fauward page (vitalos.co.uk/products/fauward) to be the template for product pages, saved for future products.

- **SOB Autofix now follows the Fauward page:**
  - the hero with "Vitalos builds and operates SOB Autofix, …"
  - the booking snapshot
  - "What it does": six icon cards
  - "How it works": the booking flow's seven steps, grouped into four, on the dark band
  - "Built for": four tiles
  - the closing card

  Every item maps to the existing evidence (`docs/content/DISCOVERY-sob-autofix.md`, "The page in the product template"). Dropped from the page: At a glance, The problem, Engineering decisions, Outcome, and the homepage and quote captures with their slots and files.

- **The template is saved and enforced:**
  - `docs/content/PRODUCT-PAGE-TEMPLATE.md`: the bands, writing rules and a seven-step checklist for adding a product.
  - Registry and template tests hold every product to the shape: three bands in order, item counts, four-word titles, ten-word lines, an icon for every card and tile, no figures, at most 180 words.
  - `pnpm media:product-snapshot` captures and encodes a product's snapshot. It reproduced the SOB Autofix snapshot exactly.
- **Simplified:** the unused `facts` and `screens` fields, their labels and the two extra image slots are gone; `sector` and `sections` are now required.

---

# Report: SOB Autofix under Products (17 Oct 2026)

Branch `feat/products-sob-autofix`, based on `main` after #74 (Products and Fauward). Discovery: [docs/content/DISCOVERY-sob-autofix.md](docs/content/DISCOVERY-sob-autofix.md). Every claim on the page maps to a line in that note: a file and line in the SOB Autofix repository, or a quotation from the live site.

## Done

- **`/products`** now shows two cards: Fauward, then "SOB Autofix", with the booking snapshot, one line and "View SOB Autofix".
- **`/products/sob-autofix`** uses the same template as Fauward:
  - the compact hero: eyebrow "Products · Automotive services", h1 "SOB Autofix", a one-sentence standfirst, and "Open sobautofix.com" (same tab, `rel="noopener"`, `outbound_click`)
  - the booking-step snapshot
  - **At a glance**: live at, sector, scope, stack, live since
  - **The problem**, **What it does** (six systems), **Engineering decisions** (five, each constraint → choice → consequence) and **Outcome**
  - **More of the site**: the homepage and Get a Quote captures
  - the closing "Talk to Vitalos" card

  Body copy is about 560 words; a unit test caps it at 700.

- **Template extended, not forked.** `ProductView` gained the optional fields `sector`, `facts`, `sections` and `screens`, rendered with the existing `Band`, `DefinitionList` (as on offer pages) and `MediaSlot`. Fauward sets none of them, so its page is unchanged; a unit test checks this.
- **Navigation.** "SOB Autofix — workshop platform" (gauge icon, "Built and operated by Vitalos") follows Fauward in Who We Are → Products and in the mobile sheet. The footer is unchanged: it links the Products index, not each product.
- **About:** unchanged. A draft-source test checks that it does not mention SOB Autofix.
- **Snapshots** are real Playwright captures of sobautofix.com at 1440×900 and 390×844 (2x): booking step 1, the homepage and Get a Quote. Optional cookies were declined. No registration was entered, and Manage Booking was not opened. They ship as AVIF and WebP at full and half width, with phone versions (10–63 KB each), in three registered slots with descriptive alt text. The asset record is in `docs/brand/asset-approval.md`.
- **SEO:** the title is "SOB Autofix: Workshop Booking and Operations | Vitalos", with a 120–155 character description, the canonical URL and the `next/og` image from the brand template. JSON-LD has WebPage `about` a SoftwareApplication (`url` https://sobautofix.com, `applicationCategory` BusinessApplication, published by the Organization) and a BreadcrumbList. Both pages are in the sitemap and llms.txt (data-driven). The Products page SEO description now names both products.
- **Bundle fix (found along the way).** The `outbound_click` listener imported the products list into the client bundle, so every product's copy shipped to every page. With SOB Autofix added, the 404 page went 429 B over its JS budget. The CTA now carries `data-product={slug}` and the listener reads it. Every route measures 195224 B gzip, down from 195658 B with Fauward alone.
- **Docs:** discovery note, ADR-031 amendment, asset record, `observability.md`, the regenerated `IMAGE-SLOTS.md`, and Lighthouse budgets that now cover `/products` and the product template.

## Verification (local, 17 Oct 2026, rebased on `main` 09b4cdd)

| Gate                                                                                                                                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint (web, cms), Prettier on changed files                                                                                    | pass. 2 lint warnings in files this PR does not touch (`media-slot.tsx`, `components.test.tsx`).                                                                                                                                                                                                                                                                                                                                                      |
| Unit tests                                                                                                                               | web 927 passed, cms 132 passed, including new tests for the product template, the registry claims and the nav order                                                                                                                                                                                                                                                                                                                                   |
| Playwright, fixtures (chromium 1440 + mobile 390 + http): products, a11y template sweep (axe, 320 px reflow, focus), sitemap, JS budgets | 193 passed, 0 failed                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/products/sob-autofix` e2e                                                                                                              | every h2 in order, the facts, all three images with intrinsic size, CTA `href`/`rel`/no `target`/`data-product`, SoftwareApplication + BreadcrumbList, axe 0 violations, no 320 px overflow, CLS ≤ 0.1 (measured 0.001)                                                                                                                                                                                                                               |
| Who We Are menu                                                                                                                          | lists Fauward then SOB Autofix; axe 0 violations with the menu open; the panel spans 39–985 px of 1024, the same as before                                                                                                                                                                                                                                                                                                                            |
| JS per route (gzip, first-party)                                                                                                         | `/products`, `/products/fauward`, `/products/sob-autofix` and 404: 195224 B (budgets 206000 / 197000)                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm seo:check --lighthouse` (repo content)                                                                                             | SEO crawl clean (65 URLs, 57 in the sitemap). `/products` and `/products/sob-autofix` scored performance 93, accessibility 100, SEO 100, CLS 0, TBT 65–82 ms on all three runs. Each `--skip-build` run had one over-budget page outside this PR, a different one each time (`/what-we-do` performance 79, then `/trust/security` TBT 312 ms); both pass on other runs. The laptop was shared with other sessions, so this is load, not a regression. |
| Playwright, draft source (real copy): products + a11y template sweep, chromium + mobile                                                  | 158 passed, 0 failed; About unchanged (no SOB Autofix), Fauward sentence once                                                                                                                                                                                                                                                                                                                                                                         |
| Storybook build                                                                                                                          | pass. No story renders the product template or nav model, so none needed changes.                                                                                                                                                                                                                                                                                                                                                                     |

**Not done:** a pixel-diff of the homepage and header against `main`. The menu's links and order are asserted, and the panel's measured box is unchanged. The non-gating visual CI job will report the new `product` route baseline.

## Needs approval

- **Merge and deploy.** The brief says not to merge or deploy, so the PR is open but not merged.
- **Copy.** The page, card and menu wording need the owner's eye.

## Unverified: Temitope to confirm or cut

1. **"Built and operated by Vitalos".** "Built" is evidenced (footer credit, every commit). "Operated" comes from the brief only.
2. **"Live since August 2026".** The first commit is 9 Aug 2026, and a doc committed 26 Aug describes production as live. No launch date is recorded.
3. **"Run on a small team's budget"** (The problem) comes from the brief, not from evidence.
4. **What sobautofix.com replaced.** Nothing in the repository says, so Outcome states only what shipped. Supply it if you want a before/after line.

Cut or narrowed because the evidence does not support them:

- mobile "eligibility": mobile is set per service, with no postcode or radius check
- Manage Booking "with email": the code asks only for reference and registration, although its README says otherwise
- coverage-area pages (plural): only Doncaster is built
- database-level clash prevention: clashes are handled by Cal.com plus a re-check at submit
- outcome figures
- the "Not Guesswork." hero line: the live hero now reads "Professional Diagnostics, and Repair."

## Assumptions

- **Title and h1.** The Fauward page as built outranks the brief, so the h1 is the product name. The brief's "A booking and operations platform for a diagnostics-led workshop" is the standfirst instead. The SEO title drops "platform" and the em dash to fit the site's 60-character limit.
- **Organization `brand`/`owns` not added.** schema.org gives `owns` the range Product/OwnershipInfo and `brand` the range Brand/Organization; SoftwareApplication fits neither, so the product links to the Organization through `publisher`, as Fauward does.
- **`cta_click`** does not exist (only `primary_cta_click` and `outbound_click`), so the card and menu item fire nothing new.
- **Screens:** booking step 1 is the snapshot (it shows the seven steps and the registration-privacy line). The homepage and quote captures are a second band. The WhatsApp launcher and a load-time focus ring were hidden in the captures.
- **Dark theme:** the site has none (see the Fauward report). The dark hero, menu card and footer surfaces were checked.
- **The template sweep route** for `product` is now `/products/sob-autofix`, because it uses every band. Fauward keeps its own axe and reflow checks in `products.spec.ts`.

## Blockers

None.

---

# Report: Products and Fauward (17 Oct 2026)

Branch `feat/nav-products-fauward`. Discovery: [docs/content/DISCOVERY-fauward.md](docs/content/DISCOVERY-fauward.md).

The brief changed during the work. It started as a nav item and an About sentence with no Products page. The follow-up asked for `/products` and `/products/fauward` pages with a real snapshot, so this branch delivers both.

## Done

- **One source of truth:** `packages/cms/src/products.ts` holds the name, menu label, one-line summary, one-sentence description, site URL and SEO. The menu, footer, About sentence, both pages, sitemap, llms.txt and JSON-LD all read it.
- **Header:** a **Products** column in the **Who We Are** menu. The heading links to `/products`, "Fauward — logistics SaaS" (gauge icon, "Built and operated by Vitalos") links to `/products/fauward`, and "All products" closes the column. The mobile sheet shows the same column in the same order, with 44 px rows. With the menu closed, the header is pixel-identical to live at 1440, 1024, 768 and 390.
- **Footer:** "Products" → `/products` in the Explore column.
- **`/products`:** compact hero, one grid with a single Fauward card (snapshot, name, one line, "View Fauward"), then the closing "Talk to Vitalos" card. JSON-LD: CollectionPage + BreadcrumbList.
- **`/products/fauward`:** compact hero (h1 "Fauward", the one-sentence description, primary action "Open fauward.com"), then the snapshot and the closing card. The action stays in the same tab, has `rel="noopener"`, and fires `outbound_click`. JSON-LD: WebPage `about` a SoftwareApplication (`url` https://fauward.com, `applicationCategory` BusinessApplication, published by the Organization). It has no offers, ratings or reviews. Any other slug returns 404.
- **About:** "Vitalos builds and operates Fauward, a logistics SaaS platform." closes the "From strategy to production" card, and "Fauward" links to `/products/fauward`. The 2×2 card grid, the single h1 and the heading order are unchanged.
- **Snapshot:** captured from fauward.com with Playwright at 1440 and 390 wide (2x). It shows the dashboard illustration, with the cookie banner dismissed and the chat launcher hidden. It ships as AVIF and WebP at full and half width through `MediaSlot` (slot `products.fauward.hero`, 21:9, with a 5:7 phone version below 768 px), with a real `srcset`/`sizes` and the alt "Fauward dashboard showing shipment operations".
- **Sitemap and llms.txt:** both routes are in the sitemap and the route manifest. llms.txt gains the About sentence under the company description, plus a Products section.
- **Analytics:** `outbound_click` (`destination` = product slug) joins the closed taxonomy and is fired by the existing delegated listener. No new dependency.
- **Docs:** ADR-031 and ADR-022 amendments, the asset record in `docs/brand/asset-approval.md`, `docs/operations/observability.md`, and the regenerated `docs/design/IMAGE-SLOTS.md`.

## Verification

All of these were run locally on 17 Oct 2026:

| Gate                                                                                                                 | Result                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck` (web, ui, cms, relay-knowledge)                                                                          | pass                                                                                                                                                                                                                                                                                                                |
| `lint` (web, ui, cms) and Prettier                                                                                   | pass                                                                                                                                                                                                                                                                                                                |
| Unit tests                                                                                                           | web 923 passed, cms 128 passed, ui FeatureGrid 5 passed                                                                                                                                                                                                                                                             |
| `next build`                                                                                                         | pass; `/products` static, `/products/fauward` SSG, OG images for both                                                                                                                                                                                                                                               |
| `pnpm seo:check --lighthouse`                                                                                        | pass: 64 URLs crawled, 56 in the sitemap, every Lighthouse budget met, CLS 0 on all templates. A first run flagged thin server HTML on both new pages (fixed with a fuller lead and the snapshot caption) and a one-off 84 on `/what-we-do/engineering`, which scored 91 on the re-run with no change to that page. |
| Playwright, fixtures (`chromium` 1440 + `mobile` 390)                                                                | `products.spec.ts` + `sitemap.http.spec.ts`: 14 passed (2 draft-only skips); a11y sweep + 320 px reflow on both new templates: 8 passed                                                                                                                                                                             |
| Playwright, draft source                                                                                             | 28 passed, including the About sentence (once, linked)                                                                                                                                                                                                                                                              |
| axe with the Who We Are menu open (1440) and the mobile sheet open (390), `/about`, `/products`, `/products/fauward` | 0 violations                                                                                                                                                                                                                                                                                                        |
| Header, menu closed, vs live main                                                                                    | pixel-identical at 1440, 1024, 768 and 390                                                                                                                                                                                                                                                                          |
| Who We Are panel at 1024                                                                                             | 39–985 px of 1024, no overflow                                                                                                                                                                                                                                                                                      |

The **visual** CI job (non-gating, ADR-021) will report differences. Every full-page baseline gains the footer's "Products" link, and the two new templates have no baseline yet. Re-adopt the `linux-ci` baselines after merge as `tests/visual/README.md` describes.

## Needs approval

- **Merge and deploy.** The brief said not to merge or deploy, so the PR is open but not merged. Merging deploys to production.
- **Copy.** The new strings are the owner's sentence plus short structural copy: "Software Vitalos builds and operates." (Products lead), "A logistics SaaS platform, built and operated by Vitalos." (card), "Built and operated by Vitalos" (menu line), and the two SEO descriptions. They need the owner's eye.

## Blockers

None.

## Assumptions

- **Placement.** The header stays at the owner's three menus (ADR-031). A fourth What We Do column needs about 68rem against about 59rem at 1024 px, so Products went into Who We Are as its third column, which matches What We Do's current width. The footer uses Explore rather than a sixth column, which would wrap at `xl`.
- **Link targets.** The follow-up's targets were used: nav and footer → `/products`, menu item and About link → `/products/fauward`. The only external link is "Open fauward.com", in the same tab with `rel="noopener"`. `https://fauward.com` answers 307 → `https://www.fauward.com/` (200), and it was kept as specified.
- **Analytics event name:** `outbound_click`. Note that Vercel drops custom events on the Hobby plan (DECISIONS 23).
- **Images.** The full-page captures were mostly blank below the hero (scroll-reveal content) and were partly covered by the cookie banner. The slot therefore uses a clean capture of the dashboard element. The PNG named in the brief (`public/media/products.fauward.hero.png`) is not shipped: it would be a heavy public file, and the browser never needs it beside AVIF/WebP.
- **"Light and dark".** The site has no dark colour scheme (only Relay does). Dark-tone surfaces (hero, menu card, footer) were checked.
- **"Compact hero" on `/products`** follows the brief, although the design system gives top-level pages the full hero.

## Found along the way (left alone)

- **The mobile snapshot shows a Fauward layout bug.** At 390 wide, fauward.com's dashboard badges ("ASSIGNED", "DELIVERED") overlap the driver names, and the page is 406 px wide (horizontal scroll). The 390 capture shows this faithfully. Fix it on fauward.com and recapture, or use only the desktop capture.
- **`TextLink` `arrow={false}` is `inline-flex`**, so an "inline" link breaks the sentence into lines for `innerText`/copy and cannot wrap. The card link here renders as a plain inline `<a>` with the same tokens instead. The primitive is worth fixing site-wide.
- **Stale `apps/web/.next/types`** referenced the removed `/about/leadership` route and failed `tsc` locally until regenerated (`next typegen`). This was local only; CI builds fresh.
- **The SoftwareApplication item has no offers or rating**, so Google will show it as an item without a rich result. That is by design: nothing is invented.
