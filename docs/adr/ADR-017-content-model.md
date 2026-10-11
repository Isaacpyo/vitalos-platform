# ADR 017 Content model and editorial governance

Status: Accepted. Studio remains undeployed; no remote Sanity project is configured (ADR 005).

## Context

Stage 8 §21 and Stage 10 §9 require structured content with relationships, editorial governance (owner, status, review date, evidence classification), required SEO fields, slug-change redirect handling, an approved block set instead of free rich text, and publish validation that prevents orphan pages. Stage 6 §14 and Stage 0 §39 add that controlled evidence stays out of the public CMS and that editors can never insert HTML, CSS, class names or uncontrolled layouts. The baseline had ten identical generic `entity()` schemas with no relations, SEO, evidence or editorial status.

The web app reads content only through `ContentSource` and the framework-free view models (ADR 022). The schema must therefore be able to feed those view models without leaking anything the view models exclude.

## Decision

1. **One schema set, Studio-only.** `packages/cms/src/schemaTypes` (entry `@vitalos/cms/schemas`) defines 15 objects and 15 document types. Studio-only code lives behind `./schemas`, `./structure`, `./actions` and `./presentation`; `apps/web` may import none of them (dependency-cruiser). Document types: `practice`, `solution`, `offer`, `industry`, `caseStudy`, `insight`, `person`, `labAsset`, `trustItem`, `job`, `legalPage`, `routePage`, `homePage` (singleton), `siteSettings` (singleton), `redirect`. Reusable objects: `seo`, `governance`, `evidence`, `cta`, `approvedImage`, `richText` and its blocks `callout`, `pullQuote`, `figure`, `codeBlock`, `dataTable`, plus `stat`, `outcomeMetric`, `testimonial`, `hero`. Model overview and ERD: `docs/cms/content-model.md`.

2. **Validation logic is pure and shared.** Every custom rule is a pure function returning `Issue[]` (`schemaTypes/rules/*`). `errors()` and `warnings()` adapt them to Sanity `Rule.custom` (warnings never block). Async rules (uniqueness, redirect chains, slug change) take an injected client so tests use an in-memory dataset. Document-level rules carry cross-field relationships because Sanity does not validate hidden fields and field-level rules cannot see siblings.

3. **Governance on every document.** `governance` (owner, `editorialStatus` draft | review | approved | needs-review | archived, `reviewDate`) is required on all documents. An approved document whose review date has passed fails validation. The desk has two queues: "Needs review" (review date passed, not archived) and "Awaiting approval" (status review).

4. **Evidence is a pointer, never the evidence.** The `evidence` object holds `evidenceStatus` (verified | pending | n/a), `classification` (public | controlled, no default so the editor must choose), `evidenceOwner`, `evidenceReference` and `verifiedAt`. The reference is a single-line internal pointer (a register or data-room ID), at most 200 characters; a URL-looking pointer is warned. Verified evidence requires owner, reference and a verification date that is not in the future. `classification: controlled` means the content must never be projected to the website; the evidence itself is held in the controlled evidence room outside the CMS.

5. **Claim rules are validation, not convention.**
   - Offers have no price field. An offer must link to at least one solution or practice (no orphan offers); a solution must list at least one offer (Stage 10 §15).
   - A case study records its engagement basis. A named client requires a client name and verified permission evidence; an anonymised one must not carry the name and needs a non-identifying description. Screenshots and architecture figures require recorded disclosure approval. Metrics and statistics require a source (metrics also context).
   - Insights require at least one named author and `updatedAt` not before `publishedAt`.
   - Lab assets require known limitations; repository and demo URLs only when `maintained`; `production-product` requires verified support evidence. Slugs are unique per lab type.
   - Trust items: one per topic. Certifications need name, scope, issue and expiry dates, current (not expired) and verified evidence. A controlled item is flagged by a warning and may not carry certification or subprocessor rows. Controlled content cannot be published (see 7).
   - Jobs: an open role needs an https application link, a description and a valid-through date that has not passed.
   - Rich text allows styles normal and h2-h4, bullet and numbered lists, strong, emphasis and code, https-only links and internal reference links. Diagram figures require a text alternative; pull quotes require an attribution; tables require a caption and consistent rows. Images require alt text unless marked decorative and carry a rights status; the web app shows only images with approved rights.

6. **Redirects are content with guards.** A redirect source starts with a single `/`, has no query, fragment, spaces or trailing slash, and may not shadow a live static page or an API route. Status is 301, 308 or 410 (410 has no destination). Sources are unique. Chains are rejected: a redirect's destination may not be another redirect's source (or a 410), and its source may not be another redirect's destination. When a published document's public URL changes (slug or lab type), the slug field warns while editing and publishing creates a deterministic draft 301 in `review` status for an editor to approve.

7. **Publish is guarded.** The Studio replaces the built-in Publish action: it is disabled unless the draft's status is `approved`, governance is complete and current, there are no validation errors and the document is not controlled. Controlled content is blocked from publishing because published documents are readable through the dataset API. Singletons cannot be duplicated, deleted or unpublished and are absent from the global "new document" menu.

8. **Reference direction.** Parent to child references are strong (practice to solution to offer, industry to its lists, insight to person). Back-pointers (offer to solution and practice, solution to practice, case study to practice, solution and industry) are weak so that two sides can be published in either order. Reverse relations a view model needs (for example a practice's offers) are derived by the query layer. Documents reference each other by id; the public URL always comes from `routes.ts`.

9. **Homepage headings are Studio initial values only.** `homePage.homeSections` is an array of `{sectionKey, visibleHeading}` whose initial value is generated from `locked-copy.ts` (`homeSections`): the section key for every section and a heading only where a spec quotes one. The site renders what is saved and never falls back to the initial values, so a section with no heading renders no heading.

10. **Studio preview and build.** `apps/studio/sanity.config.ts` wires the desk structure, the actions, and the Presentation tool with resolvers derived from `routes.ts` and the draft-mode route from `apiRoutes`; the preview origin is `SANITY_STUDIO_PREVIEW_URL` (default `http://localhost:3000`). Without `SANITY_STUDIO_PROJECT_ID` the config falls back to a placeholder project id so `sanity build` and `sanity schema extract` (`SANITY_SCHEMA_EXTRACT=1`) work in CI without credentials. Nothing here deploys the Studio.

11. **Locale.** Every document has a hidden, read-only `locale` field with initial value `en-GB`, so a future locale layer does not require a data migration.

## Options

- Keep generic entities and validate in the web app. Rejected: invalid content could be published, and rules would be duplicated and untestable in the Studio.
- One document per page with free-form sections (page builder). Rejected by Stage 10 §9 (approved block set, no uncontrolled layouts).
- Strong references everywhere. Rejected: offer and solution reference each other, which makes publication order unsatisfiable.
- Block publishing through Sanity roles only. Not sufficient alone; roles are still needed at deploy time but cannot express evidence and relationship rules. Recorded as a follow-up.

## Reasons

Structured, validated content keeps claims honest (Stage 0 §40), lets the same rules run in the Studio and in tests, and keeps the contracts that C2 maps (view models, GROQ projections) explicit. Pure rules are cheap to test without loading the Studio SDK.

## Trade-offs

- Document-level validation reports errors at the document path, so some fields show their error through the document-level message. Rules return a `path` so Studio anchors them to the field.
- Weak back-pointers can dangle if the target is deleted; mappers must drop unresolved references and archival is preferred to deletion.
- Blocking publish for controlled content means a Trust Register entry that must stay controlled can live only as a draft; the register of record is outside the CMS.
- The schema test harness implements the subset of Sanity's `Rule` API the schemas use and throws on anything else. It is not Sanity's own validator, so Studio behaviour is verified manually when the Studio is first deployed.
- The offer timeframe categories (`short`, `medium`, `long`, `ongoing`) and the CTA intents are provisional and need owner confirmation.

## Consequences

- C2 writes GROQ against the field names in `docs/cms/content-model.md` and must exclude `evidence.classification == "controlled"`, archived documents, unverified certifications, testimonials without granted permission and images without approved rights.
- `@vitalos/cms` gains an `./actions` subpath export.
- Adding a view-model property requires deciding its schema source: `view-model-contract.test.ts` stops compiling until it is mapped.
- Any change to evidence, governance or relationship rules supersedes this ADR.

## Revisit triggers

Sanity roles and workflow features that make an approval gate native; a second locale; a need for per-document approvers distinct from owners; a private dataset (which would allow controlled drafts to be published safely).
