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
