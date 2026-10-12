# How to edit site content

Site content lives in the repository and ships with each deployment (ADR-028). There is no CMS, no Studio and no webhook: a change is a pull request, and it goes live when the owner merges it and a deployment runs.

## Where each page's words live

| What you want to change                                                                                   | File                                                                 |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Page headings, introductions and bodies for the route pages (Home, About, How we work, Trust, and so on)  | `packages/cms/src/draft/content/pages.ts`                            |
| What we do: the five practices                                                                            | `packages/cms/src/draft/content/practices.ts`                        |
| Solutions                                                                                                 | `packages/cms/src/draft/content/solutions.ts`                        |
| Offers                                                                                                    | `packages/cms/src/draft/content/offers.ts`                           |
| Industries                                                                                                | `packages/cms/src/draft/content/industries.ts`                       |
| Labs assets                                                                                               | `packages/cms/src/draft/content/labs.ts`                             |
| Trust Centre topics                                                                                       | `packages/cms/src/draft/content/trust.ts`                            |
| Legal pages that are served (today the privacy notice)                                                    | `packages/cms/src/repo/legal.ts`                                     |
| Company facts shown in the footer and contact page (legal name, company number, registered office, email) | `packages/cms/src/repo/settings.ts`                                  |
| Navigation labels, button labels, practice, solution and offer names (locked copy)                        | `packages/cms/src/locked-copy.ts`                                    |
| Redirects and retired URLs                                                                                | `apps/web/src/features/redirects/additional-redirects.ts`            |
| Images                                                                                                    | `apps/web/public/` (same-origin paths such as `/images/example.png`) |

The `draft/content` folder name is historical: those files are the source for the `repo` content source that production serves. The `repo` source (`packages/cms/src/repo/index.ts`) serves the drafted content with four rules applied: invented placeholder documents are dropped, only the legal pages in `repo/legal.ts` are served, site settings come from `repo/settings.ts`, and any paragraph still containing a bracketed placeholder such as `[to be confirmed]` is left out (with a heading that would be left empty). Nothing is substituted, so an unconfirmed fact simply does not appear.

## Changing wording

1. Create a branch from `stage-1`.
2. Open the file from the table and edit the quoted text. Use plain text in the existing helpers (`h2`, `p`, `ul` and similar); do not add HTML, CSS or class names.
3. Do not add prices, client names or logos, outcomes, testimonials, certifications, biographies or legal claims unless the owner has approved them and the evidence exists. Controlled evidence never goes in the repository.
4. Run the checks locally: `corepack pnpm check`. The tests scan everything the site serves for placeholders, draft marks and invented-content markers.
5. Preview locally with `corepack pnpm dev:web` (default content source `repo`). To see the whole drafted set including placeholders use `VITALOS_CONTENT_SOURCE=draft VITALOS_ENQUIRY_BACKEND=memory`.
6. Open a pull request into `stage-1`. The owner reviews and merges; production follows the normal release process (`docs/operations/deployment.md`).

## Adding an approved legal page

Add one `LegalPageView` to `approvedLegalPages` in `packages/cms/src/repo/legal.ts`, with its version and effective date. The draft skeletons in `draft/content/legal.ts` are never served.

## Sections that stay closed

Work, Insights, Careers and Leadership only open when there is real, approved content behind them (publication gates, ADR-022). The documents that would open them today are invented placeholders, so they stay out of the `repo` source and the sections stay closed. Replace a placeholder with approved content (remove `placeholder: true` and the invented details) to open its section.

## Images

Put the file in `apps/web/public/` and reference it by path. Only same-origin images render: the Content-Security-Policy is `img-src 'self' data:` (ADR-020). Every meaningful image needs alt text; a decorative one is marked decorative. Use only brand assets the owner has approved (`docs/brand/asset-approval.md`).

## Reference

- `docs/content/draft-inventory.md`: what each drafted document is and what is still pending approval.
- `packages/cms/src/content/types.ts`: the view-model shapes the pages render.
- ADR-028: why content is in the repository.
