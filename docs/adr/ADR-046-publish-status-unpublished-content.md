# ADR 046 Publish status: unpublished repo content is served on previews only

Status: Proposed (engineering, 25 October 2026). Website Build Pack for the Health & Care launch (owner, 25 October 2026): "Everything new ships hidden or as a draft until Temitope approves it."

## Context

Under ADR-028 the `repo` content source serves every drafted document except invented placeholders. A document is approved by merging it, so there was no way to merge a page for review on previews while keeping it off vitalos.co.uk. The `draft` source cannot help: it is refused in production and carries the whole placeholder set.

## Decision

1. **`publishStatus`** (`draft` | `approved` | `published`) is an optional field on every document, summary and on embedded blocks such as an industry's `landing`. Absent means published, so all existing content is unchanged.
2. **Two repo sets.** `repoContent` (production) drops every object marked draft or approved, at any depth: the document, its summaries in other documents' relations, and fields such as `landing`. A published page therefore never links to, lists or counts a draft. `repoPreviewContent` keeps them, sets `seo.noindex` on unpublished documents, and counts unpublished case studies towards the Work gate.
3. **The web factory chooses by deploy environment**: `createRepoContentSource({ includeUnpublished: deployEnv !== "production" })`. Previews, staging and local builds show drafts; production never does. Relay's knowledge ingest uses the default (production) set.
4. **Never listed.** The sitemap skips unpublished documents in every environment.
5. **Visible on previews.** Pages that are, or show, an unpublished document render a "Draft, not published" notice (`DraftNotice`).
6. **Approval** is a pull request that sets `publishStatus: "published"` (and, for a case study, verified evidence), merged by the owner.

## Consequences

- Owner review happens on the Vercel preview of the pull request, before anything is public.
- Content that depends on the admin (Insights, ADR-039) keeps its own draft workflow; the four Health & Care posts are imported as admin drafts.
- Tests: the repo source holds nothing unpublished in production (`repo.test.ts`); the factory passes `includeUnpublished` only outside production (`content-source.test.ts`).
