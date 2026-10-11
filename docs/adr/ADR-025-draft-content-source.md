# ADR 025 Draft content source

Status: Accepted (engineering). Every draft document is pending owner approval; nothing here is approved copy. See the status note at the end (11 October 2026): the placeholder-content directive amends decision 5.

## Context

On 10 October 2026 the owner asked for a site that is "rich, full, robust" before real editorial content exists in Sanity (handoff §7). The rules that already govern the platform still apply: no invented clients, case studies, metrics, testimonials, logos, certifications, legal claims or people (AGENTS.md, Stage 6 §1, Stage 11 §38); locked copy lives only in `packages/cms/src/locked-copy.ts`; publication gates close sections without real content (ADR-022); `fixtures` are deliberately artificial and rejected in production (ADR-018, ADR-022). No remote Sanity project is configured (ADR-005), so the owner cannot yet enter content there.

The owner's own strategy library (`docs/strategy/`, Stages 0 to 20) contains enough specific, approved-direction material to draft most editorial content: practices, solutions, offers, industries, delivery stages, trust commitments and Labs concepts. It names no client, no case study, no certification held and no public author.

## Decision

1. **A fourth content source, `draft`.** `VITALOS_CONTENT_SOURCE=draft` selects `createDraftContentSource()` from `@vitalos/cms/draft`. It reuses the in-memory source the fixtures use (`createFixtureSource`), so publication gates, sitemap eligibility, `noindex` handling and closed-role rules behave exactly as for any other source.
2. **Never in production, never with real enquiries.** `@vitalos/config` rejects `draft` (as it does `fixtures` and the `memory` enquiry backend) whenever the resolved deploy env is production: `VITALOS_DEPLOY_ENV=production`, or `VERCEL_ENV=production` with `VITALOS_DEPLOY_ENV` unset. `VERCEL_ENV=production` combined with any other `VITALOS_DEPLOY_ENV` (`local`, `preview` or `staging`) is itself rejected, so an override can never switch the production guards off on the production deployment. The web content-source factory refuses `draft` again for a production deploy env before loading the module. `draft` with the `supabase` enquiry backend is rejected in every environment, because the draft privacy notice is not in force and personal data must not be recorded against it. There is no empty fallback: asking for draft content and silently serving an empty site would hide a packaging error.

   _Build time versus runtime._ Pages are prerendered at build time, so the content source is fixed by the environment the build ran with. The guard that stops a production build with draft or fixtures content is the build-time check: `apps/web/next.config.ts` calls `readBuildEnv()`, which runs the same validation and fails the build. A draft or fixtures build made for a preview or staging environment must therefore never be promoted to production without a rebuild in the production environment (for example Vercel "Promote to Production" of a preview deployment); `docs/operations/deployment.md` records this.

3. **Repo-authored typed content.** `packages/cms/src/draft/**` holds view models (the same types the web app renders), drafted only from `docs/strategy/`. Locked strings (names, headings, CTAs) are imported from `locked-copy.ts`, never repeated. Prices, metrics, clients, people, certifications, subprocessors, legal identity and response-time promises are not drafted.
4. **Provenance per document, outside the view model.** Each document has `{ status: "draft-pending-approval", sources: [{ stage, section }], omitted? }` in a register beside the views (`draftContent.provenance`), so the public view-model contract is unchanged. A test checks that every document has provenance and that every cited section heading exists in the cited stage file.
5. **Empty stays empty; gates stay closed.** No insights (the specs name no author, Stage 8 §16 and Stage 10 §18 require one), no people, no case studies, no roles. Work, Insights and Careers therefore stay closed; Industries and Labs open because draft documents exist. Labs assets are concept maturity only, typed `research` (Stage 19 §3; accelerators are components "used internally or in controlled delivery", Stage 19 §4), with stated limitations and no links. The Trust Centre has six topics: Certifications and Subprocessors are not drafted, because nothing verified exists to list (Stage 10 §20 omits empty certification blocks and puts subprocessors in Wave 2; Stage 6 §2 prefers a smaller, truthful surface), so their routes answer 404 and nothing links to them. Trust controls are worded as standards and targets, never as controls that already exist (Stage 6 §1, §2).
6. **A visible ribbon.** While the source is `draft`, the site shell (`SiteShell`, used by every page and by both 404 pages) renders a server-side "Draft content, pending approval" notice (`DraftContentRibbon`): an `aside` landmark in the page flow above the header, readable without JavaScript, tokens only, no client code. It steps aside (CSS only) while the compact navigation sheet is open, because that sheet is sized to the viewport below the header.
7. **A Sanity export for later import.** `tooling/scripts/export-draft-dataset.mjs` writes `tooling/content/draft-dataset.ndjson`: every document as a Sanity draft (`drafts.` id, `editorialStatus: "draft"`, placeholder owner, review date), references weak with `_strengthenOnPublish`, and the provenance as an extra `draftProvenance` field. A unit test keeps the committed file in step with the source and runs every exported document through the Studio validation rules. Every array `_key` is a hyphenated lowercase slug; the repository's `.gitleaks.toml` allowlists exactly that `_key` shape in exactly that file, because the scanner's `generic-api-key` rule otherwise reads the slugs as secrets. The CI scanner is pinned (`GITLEAKS_VERSION: 8.28.0` in `.github/workflows/secret-scan.yml`) to the version that allowlist was validated against: on it, the branch and full history are clean while a planted live API key and a random `_key` in the same file are still reported. Importing is an owner-run step; no agent runs dataset commands.
8. **CI.** A separate `e2e-draft` job builds and serves the site with the draft source and runs the end-to-end and accessibility suites. Specs that assert fixture documents skip themselves under draft with an explicit reason (`tests/support/content-source.ts`); the cross-cutting sweeps (axe, reflow, focus, sitemap, crawl) run against the draft templates.

## Options

- Seed a local or preview Sanity dataset. Rejected for now: no remote project is approved, and dataset commands are owner-only.
- Make the fixtures realistic. Rejected: fixtures must stay obviously artificial so screenshots and tests are never mistaken for content (ADR-022).
- Hard-code copy in templates. Rejected: violates the content boundary (ADR-022) and the locked-copy rule.
- Store provenance in the view models. Rejected: it would change the public contract the Sanity mappers implement and could leak into pages.

## Reasons

The draft source shows the owner a populated site built from their own strategy, through exactly the same templates, gates and rules as real content, while making its status impossible to miss and impossible to ship to production. The NDJSON export means the drafting work is not lost when Sanity is configured.

## Trade-offs

- Two copies of editorial text will exist once the owner imports and edits in Sanity; the repo copy becomes stale and should then be deleted (see revisit triggers).
- The draft set is a fourth configuration to keep green in CI (one more build per pipeline).
- Some draft wording makes commitments (for example the contact page's "what happens next" and the trust summaries). They are drafts; the owner must confirm each before approval.
- Product Discovery (offer) and Technology Recovery & Reliability (solution) come from Stage 3 and Stage 4 but are not in the locked Stage 8 sets; they are drafted and flagged for an owner decision.

## Consequences

- `ContentSourceKind` gains `draft`; `ContentSourceLoaders` gains `loadDraftModule`; `@vitalos/cms` gains the `./draft` subpath export; `FixtureSet.name` accepts `"draft"`.
- `docs/content/draft-inventory.md` lists every draft document, its citations and what stayed empty and why.
- Changing a draft document means re-running `node tooling/scripts/export-draft-dataset.mjs` (the unit test fails until the NDJSON matches).

## Revisit triggers

The owner imports the dataset into Sanity (then retire `packages/cms/src/draft` and the `e2e-draft` job, or keep the export only); the owner names an Insights author or supplies case studies, leadership or legal identity; a production need to preview drafts appears (use Sanity Draft Mode, never this source).

## Status note, 11 October 2026: placeholder personas and content (owner directive)

The owner directed (Temitope, 11 October 2026): the gated sections (Insights, People and Leadership, Work, Careers) stay closed in production because no real authors, case studies or roles exist, but the owner asked for "random personas, I will edit later" so those pages open in the draft preview. This amends decision 5 ("Empty stays empty; gates stay closed") for the `draft` source only. Nothing changes for fixtures, the sparse set, Sanity or production.

What was added to `packages/cms/src/draft/`, and the guardrails that make it safe:

1. **A `placeholder` flag** on draft documents and summaries (`DocBase`, `SummaryBase`; optional, `true` only). Only the draft source sets it. Provenance records it too.
2. **Content.** Three invented personas (Founder and Managing Director, Engineering Lead, AI and Data Lead) with ordinary invented names and short role and focus-area bios drawn from Stages 13 and 14, with no credentials, employers, degrees, certifications, social links or portraits. Six articles of 900 to 1,400 words on Stage 13 themes, authored by them, with stage and section provenance and no statistics. Two anonymised illustrative case-study scenarios (generic descriptors, challenge and approach from Stages 3 and 5, no outcome, metrics, testimonial or named client). One placeholder Engineering role with no salary and no application URL (it falls back to `/contact?intent=careers`). The home page does not feature any of it.
3. **A visible notice**, "Placeholder — replace before launch", rendered by `PlaceholderNotice` on every page that renders placeholder content (article, persona, case study, role, the Insights, Work and Careers indexes, Leadership and About), beside the draft ribbon. It exists only because the content exists, and placeholders exist only in the draft source, which configuration and the factory already reject in production.
4. **Never indexed, never structured.** Placeholder documents set `seo.noindex`, the routes force `noindex`, they are out of the sitemap, and the Article, Person or ProfilePage, JobPosting and breadcrumb JSON-LD output is suppressed for them. The Work, Insights and Careers route pages are `noindex` (and unlisted) while placeholders are their only content.
5. **Never imported by accident.** The Sanity export (`toSanityDocuments`) and `tooling/content/draft-dataset.ndjson` exclude every placeholder document by default. `--include-placeholders` (default off) writes them to a separate, never-committed file (`draft-dataset.with-placeholders.ndjson`) with `draftProvenance.placeholder: true`, the role exported closed; the committed file is never changed by the flag.
6. **Gate counting, draft only.** `createFixtureSource` takes `countPlaceholderCaseStudies`; only `createDraftContentSource` sets it, so a case study flagged `placeholder` counts towards the Work gate although its evidence stays `pending`. Insights and Careers open through their existing rules (named author, open role). Without the option, and in the Sanity source (the mappers know nothing of placeholders), the verified-evidence rule is unchanged; tests prove it.
7. **Tests.** Placeholders never produce JSON-LD, are `noindex` and are excluded from the default export; all five gates are open in draft; fixtures, sparse and Sanity gate behaviour is unchanged; the notice renders on every placeholder page and nowhere else; the end-to-end and accessibility suites cover the new pages under the draft source.

Revisit: replace each placeholder with real content in Sanity, then delete the document here. When the last placeholder is gone the gates return to the real-content rules.
