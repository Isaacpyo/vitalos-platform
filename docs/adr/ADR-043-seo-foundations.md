# ADR 043 SEO foundations: host-aware indexing, sitemap index, crawler policy and IndexNow

Status: Accepted (engineering), 16 Oct 2026. Builds on ADR-018 (rendering, caching, redirects), ADR-020 (security headers), ADR-022 (routes and publication gates) and ADR-028 (repo-file content). Strategy and the decision log: `docs/seo/`.

## Context

The SEO audit (`docs/seo/AUDIT.md`) found that `www.vitalos.co.uk` already serves this app and is crawlable, and that the production deployment also answers on `vitalos-platform.vercel.app` with `Allow: /` and no `noindex`. That happens because indexability was decided once, at build time, from the deploy env. Other gaps: one flat sitemap; a crawler policy that allowed every agent by accident rather than by policy; no way to tell Bing and the other IndexNow engines about changes; and per-page metadata with no validation of the content's `seo` block.

## Decision

1. **Indexable means production and the canonical host.** `isIndexableRequest` (`apps/web/src/features/seo/site.ts`) is true only when the deploy env is `production` and the request's `Host` equals the host of `NEXT_PUBLIC_SITE_URL`. robots.txt reads the host (it is now dynamic). `next.config.ts` adds a second header rule in production that sends `X-Robots-Tag: noindex, nofollow` to every other host (`missing: host`). The rule covers static assets too. Non-production environments are unchanged: noindex everywhere.
2. **One crawler policy.** `crawler-policy.ts` lists search engines, AI search and assistant agents, and AI training crawlers. robots.txt is generated from it. Every named group repeats the `*` rules, because a crawler obeys only its most specific group. Training crawlers are switched by one constant, `allowAiTraining`, a code change reviewed in a pull request rather than an environment variable.
3. **Sitemap index.** `/sitemap.xml` is a `<sitemapindex>` listing `/sitemaps/{pages,insights,careers}.xml`, one child per section that has URLs. A single loader (`sitemap-sections.ts`) feeds both. Insights and Careers entries from the Super Admin (PR #46) join there. `lastmod` comes only from content dates, never the build time.
4. **Metadata stays in one module.** `buildMetadata` (`features/seo/metadata.ts`) remains the only way pages set metadata. A content `seo` block is validated field by field with zod (`seo-block.ts`); an invalid field falls back to the document's own fields, then the site defaults. Length limits (title ≤ 60, description 120 to 155) are enforced by tests and `pnpm seo:check`, not at runtime.
5. **IndexNow.** The key is an environment variable (`INDEXNOW_KEY`, public by design), served at `/indexnow-key.txt` on the canonical host of production only, and named as `keyLocation` in each ping. `features/seo/indexnow.ts` builds and sends pings and never throws. A workflow on GitHub `deployment_status` (Vercel's `Production` deployments) pings the sitemap URLs whose `lastmod` changed since the previous production deployment. It needs no secret. The Super Admin's outbox (PR #46) calls the same function on publish, update and removal.
6. **Redirects are 308**, in one table (`docs/seo/REDIRECTS.md`). Paths with capital letters get a 308 to the lowercase path in the proxy. Homepage fragments from the earlier single-page site are mapped in the browser (`LegacyAnchorRedirect`), because fragments never reach the server.
7. **Guardrails.** `pnpm seo:check` crawls a production build as the canonical host and as another host, and fails on the rules in `docs/seo/LAUNCH.md` §1. Lighthouse budgets per template live in `tooling/seo/budgets.json`.

## Options considered

- Enforcing noindex in the proxy only: rejected. The proxy skips static assets, and `next.config` header rules with `missing: host` cover every path.
- Making the canonical host check an env allow-list: rejected. The canonical host is already `NEXT_PUBLIC_SITE_URL`, and a second setting could disagree with it.
- Using Next.js `generateSitemaps`: rejected. It produces child files but no index, so a route handler renders the index.
- `@lhci/cli` for budgets: rejected. It is unmaintained since June 2025 and pins Lighthouse 12 with old dependencies.
- An env var for the training-crawler flag: rejected. A policy decision belongs in a reviewed commit.

## Consequences

- robots.txt and `/indexnow-key.txt` are dynamic (tiny responses). Pages stay static.
- Moving the canonical host (www → apex, LAUNCH.md §2) needs only `NEXT_PUBLIC_SITE_URL` and the Vercel domain redirect to change together. A request on the old host is then noindexed automatically until the redirect is in place.
- The visible breadcrumb trail returns below the top level (docs/seo/DECISIONS.md 13), which reverses the 12 Oct 2026 design decision. One switch turns it off.
