# WS3 notes: Insights content operations (B6, B14, F4)

Branch `review/ws3-insights`. Decisions with reasons are in `DECISIONS.md` (numbers below refer to it); public copy in `COPY-CHANGES.md`.

## B6: batch 2 imported as drafts

What changed (`superadmin/apps/insights/importing.py`, `management/commands/import_insights_batch.py`):

- `--status draft` is now the **default**; publishing needs the explicit `--status published` (decision 1).
- A draft run saves each post's working copy only: title, body, format, practice, topics and sectors, excerpt, SEO title and description and the call to action, all from the front matter. No editorial check is ticked, no revision or sync event is created, nothing reaches the website, and the organisation author's approval is not recorded (decision 2).
- `--author SLUG|EMAIL` puts every post under an existing, active person author (decision 3). It refuses an unknown author, an organisation, an inactive author, and (when publishing) an unconfirmed one. The import never creates a person author.
- Idempotent on slug: a second run reports `unchanged: 20` and writes nothing.
- Draft runs need only the edit permission; publishing runs still need the publish permission.

Tests (`superadmin/tests/test_insights_import.py`): the existing publish tests now pass `--status published`; new tests cover the draft default (no checks, revisions, sync events or publish audit rows; author not approved; rerun unchanged), `--author` by slug and by linked user email, the four refusals, and the real batch (20 drafts, 0 published, SEO fields and topics present, second run unchanged).

Local proof against a fresh SQLite database (migrate, then dry run, `--apply`, `--apply` again): see "Proof run" below.

### Production command (for the orchestrator or owner; not run by WS3)

Run from the deployed image (the batch is at `apps/insights/imports/insights-batch-2` in the image once this branch is deployed), as an execution of the release job (superadmin/docs/DEPLOY.md, "Importing a batch of approved Insights"). The command needs this branch's change deployed first: the code on `main` today defaults to **publishing**.

```sh
RG=rg-vitalos-superadmin
BATCH=apps/insights/imports/insights-batch-2
# Temitope's person author slug: the author link on the live "Introducing Vitalos" article
# (https://vitalos.co.uk/insights/authors/<slug>). Fill it in before running.
AUTHOR=<person-author-slug>

# 1. Dry run. The report's "Author:" line must name Temitope Agbola (person author).
az containerapp job start -n superadmin-release -g "$RG" --command python \
  --args manage.py import_insights_batch "$BATCH" --author "$AUTHOR"
# 2. Import as drafts (the default status; --as-user defaults to Temitope.agbola@vitalos.co.uk).
az containerapp job start -n superadmin-release -g "$RG" --command python \
  --args manage.py import_insights_batch "$BATCH" --apply --author "$AUTHOR"
# 3. Check: the report ends "Imported: 20 posts, status draft (create draft: 20)". Running step 2
#    again must end "(unchanged: 20)".
az containerapp job execution list -n superadmin-release -g "$RG" -o table
```

If step 1 says `there is no author '<slug>'`, either create Temitope's person author in Insights > Authors (and have him confirm it), or drop `--author` to use the files' "Vitalos" organisation author; both are owner decisions. Never add `--status published` until publishing is approved (RUN-PROMPT 0.2).

Notes for publishing later (owner): the drafts carry no `publish_date`; re-running the same folder with `--status published` (same `--author`) publishes them with their original dates and ticks the checks with the batch note. 00-INDEX notes 2 to 4 still apply (backdating, article 08's 26 October recheck, CTAs to `/contact`).

## B14: article page

Verified on this branch before building (PR #56 and earlier already deliver most of it, decision 11): share menu (LinkedIn, X, Copy link and more, plain URLs, no scripts), related posts (admin computes them by shared topic, at most three; the band is absent when there are none), author block with photo or initials and "More from {first name}", "Updated {date}" from `updatedAt` (contract: "set only for material updates", driven by the editor's "This is a material update" box), reading time in the dates line.

Added:

- The author's name in the author block links to the author page.
- The closing card pre-selects the contact intent from the post's practice (decision 9), `articleCta` and `contactIntentFor` in `features/content/insights/model.ts`, with unit tests.

## Index page

- Filters (format tabs, topic links) and a visible "RSS feed" link show only with more than one post; with one post the post is the featured card and nothing else (decision 10). Format views always keep their tabs. Unit tests cover one post, many posts and a format view.
- Topic filters are the existing topic links to `/insights/topics/{slug}` (server-rendered pages, no JavaScript); the featured post is the admin's pinned choice, else the newest.

## F4: editor

- Authors: one ordered checkbox list of confirmed authors replaces Author 1 to 4 (decisions 4, 5). Server keeps `MAX_AUTHORS` = 4.
- Cover: `templates/insights/_file_drop.html`, the styled file control with drag and drop and an inline preview (decision 6).
- Word count and reading time under the body, live, same rule as the website (decision 7).
- Layout: secondary panels under the editor; the rail spans both rows (decision 8).
- Tests: `superadmin/tests/test_insights_editor.py` (choices and order, save and autosave order, the 4-author limit, unknown/unconfirmed/inactive authors refused, page markup, word-count rule parity). `test_insights_views.py` posts the new `authors` field.

### Media library: follow-up

The storage layer cannot list the bucket, but every upload is a `MediaAsset` row (key, size, dimensions, purpose, alt, uploader), so a library is buildable from the database without listing storage. Not built in this run because the editor page's CSP (`img-src 'self' data:`, `config/settings/base.py`) does not allow the media host, so thumbnails would not load; this also means the existing cover preview in the editor cannot load a cover served from `CONTENT_MEDIA_PUBLIC_BASE_URL` when that is another origin (it works only when media is served from the app's own `/media`). Fallback today: drag, paste or pick an image into the body (uploads a new copy). Follow-up (WS7 owns settings): add the media origin to `img-src` for the Insights editor views (django-csp `csp_update`), then a "Library" panel listing the latest cover and body `MediaAsset` rows with Insert buttons that add `![alt](url#w=…&h=…)` as `media_upload` does.

## Screenshots

`screenshots/insights-index-{1440,390}.jpg`, `screenshots/insights-article-{1440,390}.jpg` (fake Super Admin fixtures, `tests/content`).

## Proof run

Fresh SQLite database (`config.settings.dev`, `DATABASE_URL` pointing at a new file), `migrate`, one local test user `Temitope.agbola@vitalos.co.uk` with the SuperAdmin role (local only), then `import_insights_batch apps/insights/imports/insights-batch-2` with `--report` outside the repo:

| Step            | Result                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dry run         | `Dry run (use --apply to write): 20 posts, status draft (create draft: 20).` Nothing written.                                                                                                                                   |
| `--apply`       | `Imported: 20 posts, status draft (create draft: 20).`                                                                                                                                                                          |
| `--apply` again | `Imported: 20 posts, status draft (unchanged: 20).`                                                                                                                                                                             |
| State           | 20 posts, 20 drafts, 0 published; 0 editorial checks, 0 revisions, 0 post sync events, 0 `first_published_at`; 0 posts missing SEO title or description; 0 posts without topics; author `vitalos` (organisation, not approved). |

The same flow runs in pytest (`test_the_real_batch_imports_as_twenty_drafts_and_reruns_change_nothing`). The editor was then opened on the imported "The 17% problem" draft (screenshots `admin-editor-*.jpg`): 946 words, 5 min read; checks unticked; SEO title and description filled; topics and sectors ticked; author list, reordering (Ben moved above Vitalos, saved by autosave as `['Ben Example (local)', 'Vitalos']`) and the cover preview (`example.png · 1 KB · 16 × 9`) checked in Chromium with local-only test authors.

The admin CSS for the local run was built with the web app's Tailwind v4 PostCSS plugin, because `bin/tailwind.sh` has no Windows binary; production builds it with the pinned CLI as before.
