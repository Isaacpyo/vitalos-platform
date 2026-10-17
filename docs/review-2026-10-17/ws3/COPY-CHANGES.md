# WS3 copy changes

Every public-facing text change made by WS3. Admin (internal) labels are listed separately because they are not public copy.

## Website (public)

| Page | Before | After | Source |
|---|---|---|---|
| `/insights` (index, more than one post) | No visible feed link (autodiscovery `<link>` only) | Link "RSS feed" to `/insights/feed.xml` beside the topic links | Interface label for the existing feed (`apps/web/app/(site)/insights/feed.xml/route.ts`); no claim |
| `/insights` (index, exactly one post) | Format tabs ("All", one format) and the Topics disclosure shown | Not shown (the one post shows as the featured card) | No new text |
| `/insights/{slug}` closing card | "Talk to Vitalos" → `/contact` | "Talk to Vitalos" → `/contact?intent={engineering, ai, managed-services or project}` from the post's practice | Label unchanged (locked CTA, `@vitalos/cms` `ctas.primary`); intents from `packages/cms/src/routes.ts` `contactIntents` |
| `/insights/{slug}` author block | Author name as plain text | Author name links to `/insights/authors/{slug}` | No new text |

No article text was written or changed. The 20 batch-2 articles are imported as drafts exactly as committed in `superadmin/apps/insights/imports/insights-batch-2/` (approved on 16 Oct 2026, per its 00-INDEX).

## Super Admin (internal labels, not public)

| Screen | Before | After |
|---|---|---|
| Insights editor, Authors | "In byline order. Only confirmed authors can be published." + Lead author / Author 2–4 dropdowns | "Tick up to 4, in byline order: the first is the lead author. Only confirmed authors are listed; confirm a new author in Authors first." + checkbox list, "Lead" badge, Move up / Move down buttons; error "Choose at most 4 authors." |
| Insights editor, Cover image | Native file input | "Choose an image, or drag one here." drop zone; chosen file name, size and dimensions; errors "Use a JPEG, PNG, WebP or AVIF image." and "The image is … ; the limit is 5 MB." |
| Insights editor, under the body | "{n} min read" | "{n} words · {n} min read" (live) |
| `import_insights_batch` output | "Dry run (use --apply to write): N posts (…)" | "Dry run (use --apply to write): N posts, status draft (…)"; author line names the person author when `--author` is used |
