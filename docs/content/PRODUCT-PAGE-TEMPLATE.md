# Product page template

Every product Vitalos builds and operates has a page at `/products/{slug}` built from one template: the Fauward page as it was approved on 17 Oct 2026 (vitalos.co.uk/products/fauward). SOB Autofix follows it. The next product should too. The template is enforced in code: `packages/cms/src/products.test.ts` and `apps/web/src/templates/products/ProductsTemplates.test.tsx` fail for any product that departs from it.

## The page

| #   | Band                 | What goes in it                                                                                                                                   | Source field (`packages/cms/src/products.ts`)      |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Hero (compact, dark) | Eyebrow "Products · {sector}"; h1 the product name; one sentence; the primary action "Open {domain}" (same tab, `rel="noopener"`, `data-product`) | `sector`, `name`, `description`, `url`, `urlLabel` |
| 2   | Snapshot             | One real capture of the product's own site, with a one-line caption                                                                               | slot `products.{slug}.hero`, `snapshotCaption`     |
| 3   | What it does         | 3–6 icon cards, three across                                                                                                                      | section `layout: "cards"`                          |
| 4   | How it works         | 3–5 numbered steps on the dark band                                                                                                               | section `layout: "steps"`                          |
| 5   | Built for            | 2–4 tiles: the people or businesses it serves                                                                                                     | section `layout: "tiles"`                          |
| 6   | Closing card         | "Talk to Vitalos": shared, no product copy                                                                                                        | none                                               |

The same entry also feeds:

- **Who We Are → Products:** `navLabel` ("{Name} — {what it is}") and `navDescription` ("Built and operated by Vitalos").
- **The `/products` card:** the snapshot, `summary` and `viewLabel` ("View {Name}").
- **The sitemap and llms.txt:** `description`.
- **The JSON-LD:** WebPage `about` a SoftwareApplication (`url`, `applicationCategory`), plus a BreadcrumbList.
- **The page title and meta description:** `seo`.

## Writing rules

- **Lead sentence:** "Vitalos builds and operates {Name}, a/an {what it is}." It names the product once.
- **Card, step and tile titles:** four words or fewer. **Lines:** ten words or fewer, one claim each. The whole page stays under 180 words of body copy.
- **Steps:** follow the product's real flow, grouped to 3–5 when it has more (Fauward's eight steps are four; SOB Autofix's seven are four). Say so in a comment.
- **Built for:** the audiences the product's own site or code names. Do not invent customer segments.
- **No figures.** No prices, percentages, uptime, speed or outcome numbers. The registry test rejects £, $, €, % and time units.
- **Evidence.** Every claim maps to a line in `docs/content/DISCOVERY-{slug}.md`: a file and line in the product's codebase, or a quotation from its live site with the date. What the evidence does not support is left out and listed in that note. No client names, results or testimonials without written approval (AGENTS.md).
- **SEO:** title at most 60 characters with " | Vitalos" ("{Name}: {What It Is}"); description 120–155 characters.
- British English, the site's voice, no "cutting-edge" and the like.

## Adding a product

1. **Discovery.** Read the product's codebase and live site. Write `docs/content/DISCOVERY-{slug}.md` with a claim → evidence table, plus a list of what was cut and why.
2. **Snapshot.** Pick one public page that shows what the product does, never an account area or a page with personal data. Then capture it:

   ```sh
   pnpm media:product-snapshot --slug {slug} --url https://{site}/{page} \
     --consent "{decline button label}" --hide '{floating widget selector}' --top {css px} --mobile-top {css px}
   ```

   It writes `apps/web/public/media/products.{slug}.hero[.mobile][@1x].{avif,webp}`: 21:9 at 2030 × 870 wide, 5:7 at 733 × 1026 for phones. Look at all eight files and adjust `--top` until the crop shows the point of the page.

   An owner-supplied image can replace the capture at its own ratio (Fauward's is a 16:9 composite of the tenant portal, 19 Oct 2026); record it in `docs/brand/asset-approval.md`.

3. **Slot.** Copy the `products.sob-autofix.hero` entry in `apps/web/src/content/media-slots.ts`. Write a brief that says how it was captured, and alt text that says what it shows. Run `pnpm media:slots`. Add a record to `docs/brand/asset-approval.md`.
4. **Registry.** Add the entry to `products` in `packages/cms/src/products.ts`, after the existing ones, with the three sections. Give every card and tile a `key`.
5. **Icons.** Map each new key to an icon in `pointIcons` (`apps/web/src/templates/products/ProductsTemplates.tsx`). The icons are decorative; the title carries the meaning.
6. **Tests.** Add the product's slug to the order test in `products.test.ts`. Add a "states only the verified claims" test that rejects the specific claims the discovery note cut. Extend `tests/end-to-end/products.spec.ts` with the new menu item and card.
7. **Gates.**
   - `pnpm turbo run lint typecheck test --filter=@vitalos/web --filter=@vitalos/cms`
   - the Playwright products spec and template sweep (fixtures and draft)
   - `pnpm seo:check --lighthouse`

   The menu, footer, `/products`, sitemap, llms.txt and JSON-LD pick the product up from the registry; nothing else needs code.

The template bands are what the tests hold every product to. A product that genuinely needs a different band (for example a fourth section) is a design change: agree it with the owner, then change the template and its tests for every product, not just one.
