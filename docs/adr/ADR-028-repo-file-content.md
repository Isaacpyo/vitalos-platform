# ADR 028 Repo-file content replaces Sanity for the public site

Status: Accepted (owner decision, 11 October 2026). Supersedes ADR-005 in part: Sanity is no longer the editorial platform for the public site. Code removal follows in a separate change.

## Context

The owner is dropping Sanity. No production Sanity project was ever configured (ADR-005), and the live site needs content now. ADR-025 already holds typed, provenance-tracked content in `packages/cms/src/draft/**`, but the `draft` source is blocked in production, shows a draft ribbon and cannot be combined with the Supabase enquiry backend because its legal pages are "not in force" skeletons. The Stage 1 site also rendered a CMS logo `<img>` with intrinsic 2172x724 dimensions and no CSS size, which covered the hero and caused horizontal scroll.

## Decision

1. **A fifth content source, `repo`** (`VITALOS_CONTENT_SOURCE=repo`, entry `@vitalos/cms/repo`, `createRepoContentSource()`). "Repo" says where the content lives and avoids `approved`, which would imply a workflow this repo does not run; content is approved by the owner merging it. It is allowed in production and with the Supabase backend, shows no draft ribbon, and is the default when `VITALOS_CONTENT_SOURCE` is unset (production still requires it to be set explicitly, ADR-018). `draft`, `fixtures`, `empty` and `sanity` keep working until the removal change.
2. **It serves the approved subset of the drafted content.** It reuses the draft content set and the in-memory source, so the publication gates, sitemap and noindex rules are unchanged, and then:
   - drops every `placeholder` document (invented people, articles, case studies and role), so Leadership, Insights, Work and Careers stay closed through their gates;
   - serves only the legal pages in `packages/cms/src/repo/legal.ts`. Today that is the owner-approved privacy notice (version `2026-10`, effective 2026-10-11). Cookies, terms and acceptable-use stay excluded: the draft skeletons are never served. Adding an approved page means adding one `LegalPageView` to `approvedLegalPages`;
   - sets site settings to the owner-published company facts in `packages/cms/src/repo/settings.ts` (legal name, company number, registered office, support email) and nothing else;
   - drops any rich-text block that still contains a bracketed placeholder (and the heading above it), never substituting text. A test scans everything served for placeholders, draft marks and invented-content markers.
3. **Contact form.** `resolveContactPage` offers the form only with a stored-enquiry backend and a published privacy notice. With the repo source the form appears when persistence is on and `ENQUIRY_PRIVACY_NOTICE_VERSION` is unset or `2026-10`; if the privacy document is ever absent, the page falls back to the email alternative (tested).
4. **Logo.** `Wordmark` fixes any supplied logo to a 32px high, `w-auto`, `max-w-48` slot. No approved vector export exists in the repo (`docs/brand/asset-approval.md` forbids raster files from Drive or Downloads), so the repo source supplies no logo and the header and footer render the text wordmark.
5. **Editing** is by pull request to `packages/cms/src/repo` and `packages/cms/src/draft/content`. `tooling/content/draft-dataset.ndjson` stays in sync with the draft set until the removal change.

## Options

Keep Sanity and configure a project (rejected by the owner: cost and operating burden for a small site); MDX files (rejected: the typed view models, gates and provenance already exist); promote `draft` to production (rejected: it carries placeholders, skeleton legal pages and the ribbon by design).

## Trade-offs and consequences

Content changes need a deploy and a developer. Gains: no external editorial provider, one reviewed path for copy, no secrets for content. The Studio, `sanity` source, preview and revalidation code remain in the tree until the removal change; `sanity` is deprecated.

## Revisit triggers

A non-developer needs to edit content regularly; more than a handful of legal pages or articles exist; the removal change lands (then record it here).
