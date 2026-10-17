# ADR 022 Route manifest, content boundary and publication gates

Status: Accepted.

## Context

Stage 8 fixes the information architecture and URL patterns; Stage 10 sets minimum content bars before Work and Insights may appear and requires that no empty or placeholder sections ship. The Stage 1 build is split across parallel workstreams that must agree on route shapes, navigation, locked copy, view models and the rules for what happens when content is missing, without importing each other's code. The baseline homepage also contained copy that traces to no spec, listed Labs as a sixth practice and used the brand line as the H1.

## Decision

1. **One route manifest.** `packages/cms/src/routes.ts` is the only place that builds public URLs (`routes.*`, `hrefForDocument`, `hrefForRoutePage`) and lists page routes (`routeManifest`) and API routes (`apiRoutes`). The web app, Studio Presentation, the sitemap and relation links all use it.

   Pages: `/`, `/what-we-do`, `/what-we-do/[practice]`, `/how-we-work`, `/solutions`, `/solutions/[slug]`, `/offers`, `/offers/[slug]`, `/industries`, `/industries/[slug]`, `/work`, `/work/[slug]`, `/insights`, `/insights/[slug]`, `/people/[slug]`, `/labs`, `/labs/[type]`, `/labs/[type]/[slug]` (types: research, reference-architectures, demonstrators, accelerators, open-source, experiments, product-incubation), `/about`, `/about/leadership`, `/trust`, `/trust/[topic]` (security, privacy, responsible-ai, accessibility, resilience, subprocessors, certifications, procurement), `/careers`, `/careers/[slug]`, `/contact` (`?intent=`), `/legal/[slug]` (privacy, cookies, terms, acceptable-use), plus `sitemap.xml` and `robots.txt`.

   API: `/api/health`, `/api/enquiries`, `/api/draft-mode/enable`, `/api/draft-mode/disable`, `/api/revalidate`, `/api/internal/outbox/dispatch`.

2. **Publication gates are code constants** in `packages/cms/src/content/gates.ts`: Work needs at least 2 verified case studies (Stage 10 §17); Insights at least 6 with named authors (Stage 8 §16, Stage 10 §18); Labs, Industries and open Careers roles at least 1 each. Below the threshold: no navigation item, the index route calls `notFound()`, detail pages are `noindex`, and documents are excluded from the sitemap. The content source reports qualifying counts through `getPublicationGates()`; the pure functions in `gates.ts` make every decision. Sitemap rules shared by every content source live in `content/sitemap-rules.ts`: a job is listed only while `status` is `open` and `validThrough` (inclusive, date part, injected `today`) has not passed, so a role closing today is still listed; `/labs/<type>` category pages are listed when the Labs gate is open and the type has at least one listed asset.

3. **Content boundary.** The web app depends only on the `ContentSource` interface (`packages/cms/src/content/source.ts`) and the framework-free view models in `content/types.ts`. Implementations (Sanity, fixtures) are separate; `EmptyContentSource` is the honest empty state: it returns no documents and closes every publication gate. The CI quality gates (check, build, Storybook, e2e) pass without Sanity or Supabase configuration because the platform degrades to that empty state, not because gates are open. Lab asset lookups name their lab type (`getDocument("labAsset", slug, { labType })`) because slugs are only unique per type; trust items and legal pages are addressed by `TrustTopic` and `LegalSlug`. The root `@vitalos/cms` entry is Sanity-free; Studio code lives behind `./schemas`, `./structure` and `./presentation`, and `apps/web` may not import them or `sanity` (enforced by dependency-cruiser).

4. **Empty-content policy.** A missing detail document yields `null` and the page calls `notFound()`. A section without data renders nothing. Draft mode alone may show a `ContentGap` notice. No lorem ipsum or placeholder marketing copy. Fixtures are obviously artificial (`Example Practice (fixture)`, `*.invalid` addresses) and are rejected in production by `@vitalos/config`.

5. **Locked copy lives in one file.** `packages/cms/src/locked-copy.ts` holds the owner-approved strings (descriptor, proposition, brand line, navigation labels, CTAs, practice/solution/offer/industry names, the AI journey and How We Work stages, homepage section labels), each citing its spec section. Everything else comes from Sanity. The homepage H1 is the proposition; the brand line is the supporting line (Stage 8 §8, Stage 11 §9). There are five practices; Labs is not one (Stage 8 §5, §10).

   The website descriptor is the spec text "Technology Consulting, Engineering & Digital Transformation" (Stage 0 §0, Stage 8 §8, Stage 11 §9). The shortened "Technology Consulting & Engineering" is the descriptor of the approved Figma logo lockup (`docs/brand/asset-approval.md`); the owner must confirm which appears where. Homepage section names from Stage 8 §8 are structural labels and are never rendered; visitor-facing headings come from Sanity, and only spec-quoted titles are recorded as `visibleHeading` (Stage 11 §9 mockup brief, pending owner confirmation).

6. **Configuration split.** `@vitalos/config` exposes `.` (server-only), `./public` (NEXT_PUBLIC_* only) and `./build` (no `server-only`, non-secret values, safe for `next.config.ts` and scripts). The schema carries the cross-field rules. Production must set `VITALOS_CONTENT_SOURCE` and `VITALOS_ENQUIRY_BACKEND` explicitly so that an empty source or disabled enquiries are deliberate, must set `NEXT_PUBLIC_SANITY_DATASET` when the source is `sanity` (the `development` default is never used), needs an explicit https site URL, and rejects `fixtures` content, the `memory` enquiry backend and the `console` email provider. `VITALOS_DEPLOY_ENV` may not be `local` or `preview` when `VERCEL_ENV` is `production`. `NODE_ENV=production` is not a deployment signal (every `next build` and `next start` sets it, including local and CI runs); the deploy env comes from `VITALOS_DEPLOY_ENV` or `VERCEL_ENV` and defaults to `local`, which is not indexable. Site and Studio URLs must be http(s) origins and are normalised to the origin. `next.config.ts` injects the resolved site URL as `NEXT_PUBLIC_SITE_URL`, so server and client agree and `./public` never invents a fallback. `sanity` needs a project id; `supabase` needs its URL and secret; Turnstile keys come as a pair. `features` (cms, turnstile, enquiryPersistence, emailNotifications, indexable) is derived from the validated environment; `indexable` is true only in production.

## Options

- A single `@vitalos/cms` barrel that also exports schemas: rejected, it would pull the Sanity Studio SDK into web bundles.
- Gate thresholds stored in Sanity: rejected, editors would be able to publish an empty or thin section by editing a number; thresholds are policy, not content.
- Route builders duplicated in the web app: rejected, Studio Presentation and the sitemap would drift from the app.

## Reasons

Parallel workstreams need stable contracts. Keeping gates, routes and locked copy as typed code makes them testable, reviewable and hard to change by accident, and keeps unverified or empty sections from reaching the public.

## Trade-offs

Changing a threshold, route or locked string is a code change with review rather than an editorial action. The view models are a second description of the content shape beside the Sanity schemas; mappers (workstream C2) keep them aligned and tests guard the public-safety projections.

## Consequences

- Later workstreams extend `packages/cms` only through the owned files; changes to routes, navigation, locked copy, view types, source and gates are reviewed.
- `check:boundaries` fails any `apps/web` import of `sanity`, `@vitalos/cms/schemas|structure|presentation`; `packages/ui` may not import `next`, `@vitalos/cms`, `@vitalos/config` or `@supabase/*`; `packages/*` may not import `apps/*`.
- Until the content workstreams land, the homepage renders locked copy only and links to routes that are not yet built.

## Revisit triggers

Owner changes the minimum content bars or the information architecture; a content type needs a route not in the manifest; gate evaluation needs data a count cannot express; locked copy is superseded by approved brand work.

## Status update (10 Oct 2026)

The last consequence ("until the content workstreams land, the homepage renders locked copy only and links to routes that are not yet built") no longer holds: every route in the manifest is built (G1, H, G2a, G2b, with C2 supplying queries, mappers and fixtures). The homepage builds its sections from the content source and renders each one only when data exists; with the empty source it still shows locked copy only. No decision in this ADR is changed.

## Status update (17 Oct 2026): Products

`/products` (route-page key `products`) and `/products/[slug]` join the manifest, both in the sitemap and ungated. Products are not a content-source document kind: they live in `packages/cms/src/products.ts`, so `/products/[slug]` is statically generated from that list (`dynamicParams = false`; any other slug is a 404). The sitemap lists each product page while the Products route page exists (`buildSitemap`). See the ADR-031 amendment of the same date.
