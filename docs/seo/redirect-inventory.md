# Redirect inventory

Status (10 Oct 2026): only the four redirects named in the specification are seeded. The live-site URL inventory has not been supplied, so no other redirect exists and none has been guessed. Launch gate G7 (`docs/delivery/launch-gates.md`) cannot close until the inventory is reviewed with the owner.

Mechanism: ADR-018 decision 7 and the refinements. Code: `apps/web/src/features/redirects/` (`redirect-map.ts`, `additional-redirects.ts`, `validate.ts`, `gone.ts`, `next-redirects.ts`).

## Seeded redirects (version-controlled in `redirect-map.ts`)

Source: Stage 8 section 7 (URL architecture) and Stage 10 section 12 (legacy routes).

| Source          | Destination      | Status |
| --------------- | ---------------- | ------ |
| `/services`     | `/what-we-do`    | 301    |
| `/technologies` | `/labs`          | 301    |
| `/privacy`      | `/legal/privacy` | 301    |
| `/terms`        | `/legal/terms`   | 301    |

Notes:

- `/labs` is gated: below its publication threshold (1 approved lab asset) the destination answers 404 until Labs content exists. Decide whether `/technologies` should wait or go elsewhere before cutover.
- `/legal/privacy` and `/legal/terms` need published legal pages; until then the destinations answer 404.
- `additional-redirects.ts` is empty: no further redirects have been approved.

## Rules enforced at build

`next.config.ts` validates the whole map (seed plus `additional-redirects.ts`) and fails the build on a violation:

- exact paths only (no wildcards, regular expressions or query handling); sources start with a single `/`;
- unique sources; no chains; no loops;
- no blanket redirect to `/`;
- no redirect of a live static route;
- same-site destinations, or https URLs (external destinations skip the chain, loop and blanket checks);
- status 301, 308 or 410. A 410 answers `Gone` from `proxy.ts` and has no destination.

A dynamic detail path such as `/insights/old-slug` may be redirected so slug changes work; a static manifest page or `/api` path may not.

## Pending: live URL inventory (owner input)

Provide the crawl or sitemap of the existing live site (owner decision 12, `docs/delivery/owner-decisions.md`). For each URL record the decision below; add rows here only from the real inventory.

| Legacy URL | Traffic or backlinks (if known) | Decision (redirect, retire with 410, keep) | New destination | Status | Decided by | Date |
| ---------- | ------------------------------- | ------------------------------------------ | --------------- | ------ | ---------- | ---- |
| _pending_  |                                 |                                            |                 |        |            |      |

Principles (Stage 10 section 12, ADR-018): redirect each retired URL to the closest equivalent page, never blanket-redirect to the homepage, answer 410 for content that is intentionally gone, keep chains out, and keep the canonical host decision consistent with `NEXT_PUBLIC_SITE_URL`.

## Process for adding redirects

1. Add the rule (301 or 308 with a destination, or 410) to `apps/web/src/features/redirects/additional-redirects.ts`. For a changed slug, add a 301 from the old path to the new one in the same pull request.
2. The unit tests and the build validate the whole map (no chains, loops, blanket redirects or live-route shadowing).
3. Review in a pull request into `stage-1`, merge and redeploy. Redirects ship with the deployment.

## Verification before cutover

- Every inventory row has a decision and an owner.
- The build passes (it validates the map) and the redirect unit tests pass (`apps/web/src/features/redirects`).
- On the candidate deployment, each source returns its recorded status and destination in one hop, and each 410 returns 410.
- `sitemap.xml` lists no redirected or gone URL.
- Redirect end-to-end coverage (workstream F2) has not landed yet, so these checks are manual until it does.
