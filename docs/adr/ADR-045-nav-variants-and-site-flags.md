# ADR 045 Navigation variants, six practices, and the podcast and founder flags

Status: Accepted (17 Oct 2026 review run, owner decisions 1, 2, 3 and 6). Amends ADR-031 (site navigation: three menus). Builds on ADR-022 (publication gates) and ADR-028 (repo-file content).

## Context

The 17 Oct review found that the header (What We Do · Who We Are · Support, ADR-031) differs from the locked information architecture of Stage 8 §6, so Industries and Insights are not reachable from the header (B2); that the site counts five practices where the brand, the admin's service lines and the first published Insight count six (B1); that the footer promotes a podcast with no episodes (B5); and that About has no founder or company facts (B4).

The owner decided before the run: six practices, Labs the sixth (decision 1); keep the current header in production and build the locked IA as a variant shown on previews (decision 2); hide the podcast behind a flag (decision 3); label the enquiry page "Contact" in the IA nav (decision 6). Publishing the founder section is an approval item.

## Decision

1. **Six practices.** `firmPracticeNames` (locked copy) is the five practice pages plus `labsPracticeName` ("Labs"). `practiceNames` stays the five with a page under `/what-we-do/[practice]`; Vitalos Labs keeps `/labs`. Wherever practices are counted or listed (the homepage and About heading "Six practices, one firm", the What We Do and homepage showcases, the mega-menu Practices column, the footer What We Do column) Vitalos Labs is the sixth entry and links to `/labs`, only while the Labs gate is open, so nothing links to a 404. Its line is the first sentence of the Labs page introduction; its illustration is chosen by name like the others (`practiceImageFor`, key `labs`) and is absent until the artwork exists. The footer lists `/labs` once (as a practice, not again under Explore).
2. **Navigation variants.** `NEXT_PUBLIC_NAV_VARIANT` = `current` | `ia`, validated in `packages/config`. Unset, it is `ia` when `VERCEL_ENV=preview` and `current` everywhere else, so previews show the IA without any Vercel setting and production is unchanged. The header model carries the variant so the current section is matched to the right keys (`activeSectionForPath(path, variant)`).
   - `current`: exactly the ADR-031 header (a test asserts that omitting the variant and passing `current` build the same model).
   - `ia` (`iaPrimaryNav`, `iaHeaderNav`): What We Do (mega-menu: Practices, Solutions, Offers (the priority offers), Industries, Labs; no feature card, so five columns fit from 1024 px), Industries, Work, Insights, Labs, About; gated items only while their gate is open. While Work is closed its slot shows **Labs** (`iaWorkFallback`) and the separate Labs item is dropped, so Labs appears once and nothing links to `/work`. Utility links: Trust Centre and Contact (decision 6). Primary action: Talk to Vitalos. The compact menu sheet shows the same items and utility links (SiteHeader passes them to MobileNav).
3. **`PODCAST_ENABLED`** (default false). Off: the footer has no podcast block and `/podcast` answers 404 (`notFound()`). The route was already out of the sitemap (`routeManifest` `sitemap: false`); nothing else changes. The code and the placeholder URLs stay for when the show launches.
4. **`ABOUT_FOUNDER_ENABLED`** (default: true when `VERCEL_ENV=preview`, false otherwise). On: About shows a Founder band built only from the published Insights author profile (name, role, bio verbatim; `packages/cms/src/repo/founder.ts`) with the `about.founder` media slot and, while Insights is open, a link to the author page. Off in production until the owner approves.
5. Flags are server-read (`getEnv().site`), declared in `turbo.json` and documented in `.env.example`.

## Consequences

- Switching production to the IA is one variable (`NEXT_PUBLIC_NAV_VARIANT=ia`), an approval item; so are `PODCAST_ENABLED` and `ABOUT_FOUNDER_ENABLED`.
- The founder text is a copy of the admin profile: when the profile changes, `founder.ts` must change too (noted in the file).
- ADR-031 decision 1 (three menus) remains the production behaviour; this ADR adds the variant beside it.
