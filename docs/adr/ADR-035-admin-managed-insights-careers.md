# ADR 035 Insights and Careers are managed in the Super Admin

Status: Accepted (owner decision, 15 October 2026). Supersedes ADR-028 **for Insights and Careers only**. Every other section keeps repo-file content.

Numbering: ADR-031 to ADR-034 are taken by the Relay work on `feat/relay`, which has not merged yet. This ADR and ADR-036 to ADR-038 start at 035 so the two branches cannot collide.

## Context

ADR-028 moved the public site's content into repository files: content is approved by merging a pull request, and every change needs a developer and a deploy. One of its revisit triggers is "a non-developer needs to edit content regularly". The owner wants Insights (the blog) and Careers (roles and applications) edited by people who are not developers, with changes live on the site within seconds and no redeploy (brief: `docs/content/BRIEF.md`).

The Super Admin (ADR-026) is a Django application with its own PostgreSQL database at admin.vitalos.co.uk. ADR-026 and ADR-029 rejected sharing a database between it and the website, and they made signed HTTP the only coupling between the two (the website contact form posts to the admin, signed).

## Decision

1. **The Super Admin owns Insights and Careers data.** New Django apps sit beside `enquiries`:
   - `insights`: posts, authors, topics, revisions, editorial checks and slug redirects;
   - `careers`: roles, revisions, applications, notes, events and settings;
   - `content_sync`: the outbox, site sections and site state.

   Every post and role has a working copy and an immutable published snapshot, as in brief decision 1.3. Admin screens follow the existing Django, HTMX and Tailwind stack and its look.

2. **The website reads only published snapshots,** server-side, from a signed read API on the admin (ADR-036). It never reads the admin's database and never writes content. The website's Supabase project is not touched.
3. **The Markdown renderer lives in the website.** The admin previews through a signed render endpoint, so preview and production cannot differ (ADR-036).
4. **Closed by default.** Two admin settings, `insights_open` and `careers_open`, both off, decide whether the sections exist publicly. While a section is closed it behaves as it did under ADR-028:
   - its index returns 404;
   - it is left out of the homepage, the sitemap, the feed and the footer.

   Opening either in production is an owner decision (approval list in `docs/content/README.md`).

5. **Repo-file content.** The `repo` content source serves no Insight and no role today: the draft set holds only placeholders, which ADR-028 drops. `pnpm content:export-repo` writes whatever the repo source serves for these two kinds as JSON, and `manage.py import_repo_content` loads it into the admin as drafts (dry run by default, idempotent by source path). The files are not deleted; deleting them is on the approval list.
6. **The website stops reading Insights and roles from `@vitalos/cms`.** The `insight` and `job` kinds and the `insights` and `careers` publication gates stay in the package, unused by these routes, until the owner approves removing the files.

## Options

- **Supabase schemas in the website's project, written by Django** (the brief before amendment). Rejected: it reverses ADR-026's isolation and puts candidate data in the public site's database.
- **A headless CMS.** Rejected for the same reasons as ADR-028 (cost, operating burden), and applications still need an operational store.
- **Keep repo files and add a Git-backed editor.** Rejected: changes would still need a deploy, and applications are not content.

## Consequences

- Two applications must stay in step on a contract: `contracts/content-api/v1/` is the source of truth, and drift fails CI (ADR-036).
- The site's Insights and Careers pages now depend on the admin's availability. The website serves cached pages when the admin is down, and the homepage never fails because of these sections (ADR-036).
- Candidate personal data lives in the admin's database and private object storage (ADR-037).
- Revisit if the admin's free hosting cannot meet the sync targets (ADR-038), or if more sections move to the admin.
