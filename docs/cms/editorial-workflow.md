# Editorial workflow

How content moves from draft to the public site. Decision records: ADR-017 (model and governance), ADR-018 (rendering, preview, revalidation, redirects), ADR-022 (gates). Field-level detail is in `docs/cms/content-model.md`.

Status: the rules below are implemented and tested in code, but the Studio is undeployed and no Sanity project is configured. The workflow has not been used by real editors; Studio behaviour is to be verified manually on first deploy (ADR-017 trade-offs).

## Principles

- Sanity owns editorial content. Code owns locked copy (`packages/cms/src/locked-copy.ts`), routes, navigation and gate thresholds. Controlled evidence stays outside the CMS.
- Development and production datasets are distinct. Never copy production enquiries or secrets into either.
- Editors cannot insert HTML, CSS or class names. Rich text allows the approved blocks only.
- No placeholder copy: an empty section renders nothing and a missing document is a 404.

## States

Every document has a `governance` object: `owner`, `editorialStatus`, `reviewDate`.

| Status         | Meaning                                                         | Visible on the public site | Visible in Draft Mode preview |
| -------------- | --------------------------------------------------------------- | -------------------------- | ----------------------------- |
| `draft`        | Being written                                                   | No                         | Yes                           |
| `review`       | Awaiting approval ("Awaiting approval" queue)                   | No                         | Yes                           |
| `approved`     | Reviewed and cleared                                            | Yes (once published)       | Yes                           |
| `needs-review` | Review date passed or content questioned ("Needs review" queue) | No                         | Yes                           |
| `archived`     | Retired; kept for history                                       | No                         | No                            |

Public queries read only `approved` documents. Setting a published document to `needs-review` or `archived` removes it from the site at the next revalidation, so use `archived` rather than deleting (weak back-references can otherwise dangle).

The status is set by editors; nothing changes it automatically. Roles that separate authors from approvers are not configured (Sanity roles are a deploy-time owner task; ADR-017 revisit triggers).

## Publish rules

The Studio replaces Sanity's Publish action. Publish is disabled, with the reasons as the tooltip, unless all of these hold:

1. `editorialStatus` is `approved`.
2. `owner` and `reviewDate` are present, the date is valid, and an approved document's review date has not passed.
3. There are no validation errors (warnings do not block).
4. The document is not `controlled` content (`evidence.classification`). Published documents are readable through the dataset API, so controlled items can live only as drafts.

Singletons (`homePage`, `siteSettings`) cannot be duplicated, deleted or unpublished.

## Claim, evidence and permission rules

Enforced as validation (`packages/cms/src/schemaTypes/rules/*`), and again by the public queries.

- Evidence is a pointer, never the evidence: `evidenceStatus` (verified, pending, n/a), `classification` (public or controlled, no default), `evidenceOwner`, `evidenceReference` (a single-line internal register or data-room ID, at most 200 characters), `verifiedAt` (not in the future). Verified evidence needs owner, reference and date.
- Case studies: record the engagement basis. A named client needs a client name and verified permission evidence; an anonymised one carries no name and needs a non-identifying description. Screenshots and architecture figures need recorded disclosure approval. Metrics and statistics need a source.
- Testimonials need an attribution and granted, evidenced permission; otherwise they are not shown.
- Offers have no price field and must link to at least one solution or practice. Solutions must list at least one offer.
- Insights need at least one named author and `updatedAt` not before `publishedAt`.
- Lab assets need limitations; repository and demo URLs only while `maintained`; `production-product` needs verified support evidence.
- Trust items: one per topic. Certifications need name, scope, issue and expiry dates, must be current and verified. A controlled item cannot carry certification or subprocessor rows.
- Jobs: an open role needs an https application link, a description and a future `validThrough`.
- Images need alt text (unless decorative) and a rights status; the site renders only rights-approved images.
- Queries never expose `evidenceReference`, `evidenceOwner` or `permissionEvidence`.

## Publication gates

Thresholds are code constants (`packages/cms/src/content/gates.ts`), not editable content.

| Section    | Needs                                                                            | Below the threshold                                                  |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Work       | 2 or more approved case studies with public classification and verified evidence | No nav item, index 404, details `noindex`, excluded from the sitemap |
| Insights   | 6 or more approved insights, each with at least one approved author              | Same                                                                 |
| Labs       | 1 or more approved lab asset (production-product needs verified support)         | Same                                                                 |
| Industries | 1 or more approved industry                                                      | Same                                                                 |
| Careers    | 1 or more approved job that is open and not past `validThrough`                  | Same                                                                 |

Editors in Draft Mode can still preview a closed section. To change a threshold, change the code (reviewed, ADR-022).

## Preview

- The Presentation tool in Studio frames the site; resolvers come from `routes.ts`. The preview origin is `SANITY_STUDIO_PREVIEW_URL` (default `http://localhost:3000`).
- Draft Mode is enabled by `/api/draft-mode/enable` using Sanity's short-lived preview secret and a read token, and disabled by `/api/draft-mode/disable`. It shows draft and in-review documents and bypasses the cache.
- In production the CSP blocks browser connections to the Sanity API, so click-to-edit overlays work on preview deployments only; server-side draft previews still work.
- Preview deployments are `noindex`; only the production deploy environment is indexable.

## Freshness

Published reads are cached with tags and a one-hour safety revalidation. A Sanity webhook to `/api/revalidate` (signature-verified, fail-closed) refreshes the affected tags immediately. The webhook is not configured yet (owner task, item 14 of `docs/delivery/owner-decisions.md`); until then pages refresh within the hour.

## Slugs and redirects

1. Changing a published document's slug (or lab type) shows a warning while editing.
2. Publishing then creates a draft 301 redirect (`drafts.redirect-<old-path>`, status `review`) for the old URL. If that draft cannot be created the publish is stopped.
3. An editor reviews and approves the redirect document. Validation requires a source that starts with a single `/` (no query, fragment, spaces or trailing slash), is not a live static page or `/api` path, is unique, and forms no chain (a destination may not be another redirect's source, or a 410). Status is 301, 308 or 410 (410 has no destination).
4. Publishing the redirect does not change the live site. The owner pulls it into code:

   ```sh
   NEXT_PUBLIC_SANITY_PROJECT_ID=... NEXT_PUBLIC_SANITY_DATASET=... \
     node tooling/scripts/redirects-pull.mjs        # writes apps/web/src/features/redirects/generated.ts
   node tooling/scripts/redirects-pull.mjs --check  # fails if generated.ts differs from Sanity
   ```

   Add `SANITY_API_READ_TOKEN` only for a private dataset. Review the `generated.ts` diff in a pull request, merge and redeploy. The build validates the whole map (exact paths, unique sources, no chains or loops, no blanket redirect to `/`, no redirect of a live route) and fails on an invalid one.

5. The four specification redirects are seeded in `redirect-map.ts`; see `docs/seo/redirect-inventory.md`.

## Review cadence

`reviewDate` drives the "Needs review" queue (review date passed, not archived). The cadence per content type is an owner decision; none is defined. Owners are named per document in `governance.owner`.
