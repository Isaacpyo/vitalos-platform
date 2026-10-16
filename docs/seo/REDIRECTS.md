# Redirects

One table of every redirect the site answers, kept in step with the code. The mechanism is ADR-018 decision 7. Code: `apps/web/src/features/redirects/` (`redirect-map.ts`, `additional-redirects.ts`, `validate.ts`, `gone.ts`, `next-redirects.ts`, `lowercase.ts` and `legacy-anchors.ts`).

All redirects are **308** (permanent, and the method is kept), in one hop. Retired paths answer **410**. The live URL inventory was taken on 16 Oct 2026 from the live crawl and the Wayback Machine (AUDIT.md, "Legacy URL inventory").

## Server redirects (`redirect-map.ts` and `additional-redirects.ts`)

| Source              | Destination      | Status | Why                                                                    |
| ------------------- | ---------------- | ------ | ---------------------------------------------------------------------- |
| `/services`         | `/what-we-do`    | 308    | Legacy URL (Stage 8 §7; captured by the Wayback Machine in May 2026)   |
| `/technologies`     | `/labs`          | 308    | Legacy URL (Stage 10 §12; captured by the Wayback Machine in May 2026) |
| `/privacy`          | `/legal/privacy` | 308    | Legacy URL (captured by the Wayback Machine in May 2026)               |
| `/terms`            | `/legal/terms`   | 308    | Legacy URL (captured by the Wayback Machine in May 2026)               |
| `/about/leadership` | `/about`         | 308    | The Leadership page was removed (owner direction, 15 Oct 2026)         |

They were 301 until 16 Oct 2026. 308 has the same meaning for search engines, and the brief standardises on it.

## Proxy rules (`proxy.ts`)

| Rule                                | Example                               | Status |
| ----------------------------------- | ------------------------------------- | ------ |
| A path with capital letters         | `/What-We-Do?x=1` → `/what-we-do?x=1` | 308    |
| A retired path (`status: 410` rule) | none yet                              | 410    |
| A trailing slash (Next.js default)  | `/about/` → `/about`                  | 308    |

## Homepage fragments (`legacy-anchors.ts`, in the browser)

Fragments never reach the server, so a client island on the homepage (`LegacyAnchorRedirect`) maps them with `location.replace`. It acts only when the page has no element with that id.

| Fragment                     | Goes to        |
| ---------------------------- | -------------- |
| `/#what-we-do`, `/#services` | `/what-we-do`  |
| `/#about`                    | `/about`       |
| `/#solutions`                | `/solutions`   |
| `/#industries`               | `/industries`  |
| `/#how-we-work`              | `/how-we-work` |
| `/#technologies`             | `/labs`        |
| `/#contact`                  | `/contact`     |

## Legacy URLs that need no redirect

| Legacy URL                                                                                    | Today                                 | Decision                                     |
| --------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------- |
| `/about`, `/contact`, `/industries`, `/solutions`                                             | 200                                   | keep                                         |
| `/contact?type=care`, `healthcare`, `other`, `digital-transformation`, `software-development` | 200, canonical `/contact`             | keep: the query is ignored and canonicalised |
| `/insights`                                                                                   | 404 while the Insights gate is closed | it comes back when Insights opens (PR #46)   |

## Host redirects (Vercel domain settings; owner approval)

| From                                                      | To                     | Status | State                                              |
| --------------------------------------------------------- | ---------------------- | ------ | -------------------------------------------------- |
| `http://*`                                                | `https://` (same host) | 308    | live (Vercel)                                      |
| `https://vitalos.co.uk/*` → `https://www.vitalos.co.uk/*` | —                      | 308    | **live today**                                     |
| `https://www.vitalos.co.uk/*` → `https://vitalos.co.uk/*` | —                      | 308    | **target**, prepared in LAUNCH.md §2, not executed |

## Rules enforced at build and in tests

`next.config.ts` validates the whole map (seed plus `additional-redirects.ts`) and fails the build on a violation:

- exact paths only (no wildcards, regular expressions or query handling); sources start with a single `/`;
- unique sources; no chains; no loops;
- no blanket redirect to `/`;
- no redirect of a live static route;
- same-site destinations, or https URLs (external destinations skip the chain, loop and blanket checks);
- status 301, 308 or 410. A 410 answers `Gone` from `proxy.ts` and has no destination.

A dynamic detail path such as `/insights/old-slug` may be redirected so slug changes work; a static manifest page or `/api` path may not. `pnpm seo:check` also fails on a redirect chain and on an internal link that redirects.

## Process for adding a redirect

1. Add the rule (308 with a destination, or 410) to `apps/web/src/features/redirects/additional-redirects.ts`. For a changed slug, add the 308 from the old path in the same pull request.
2. Add the row to the table above.
3. The unit tests, the build and `pnpm seo:check` validate it. Review it in a pull request into `main`.

## Verification before the host move

- Each source returns its recorded status and destination in one hop, and each 410 returns 410 (`tests/end-to-end/protocol.http.spec.ts`).
- The sitemap lists no redirected or gone URL (`pnpm seo:check`).
