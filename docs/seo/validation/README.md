# Structured data validation

Spot-checks of each template's JSON-LD `@graph` (16 Oct 2026, built from `feat/seo` in production mode against the repo content). Preview deployments sit behind Vercel Authentication, so the JSON-LD was pasted into the validators as code snippets.

## Schema Markup Validator (validator.schema.org)

| Template                              | Page                                              | Result               | Screenshot                                                                       |
| ------------------------------------- | ------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| Home                                  | `/`                                               | 0 errors, 0 warnings | [home](schema-validator-home.png)                                                |
| Section index (CollectionPage)        | `/what-we-do`                                     | 0 errors, 0 warnings | [what-we-do](schema-validator-what-we-do.png)                                    |
| Solution (WebPage + FAQPage, Service) | `/solutions/ai-transformation`                    | 0 errors, 0 warnings | [solution](schema-validator-solutions_ai-transformation.png)                     |
| Offer (Service)                       | `/offers/engineering-rescue`                      | 0 errors, 0 warnings | [offer](schema-validator-offers_engineering-rescue.png)                          |
| Industry                              | `/industries/health-care`                         | 0 errors, 0 warnings | [industry](schema-validator-industries_health-care.png)                          |
| About (AboutPage)                     | `/about`                                          | 0 errors, 0 warnings | [about](schema-validator-about.png)                                              |
| Contact (ContactPage)                 | `/contact`                                        | 0 errors, 0 warnings | [contact](schema-validator-contact.png)                                          |
| Trust topic                           | `/trust/security`                                 | 0 errors, 0 warnings | [trust](schema-validator-trust_security.png)                                     |
| Lab asset                             | `/labs/research/production-ai-evaluation-harness` | 0 errors, 0 warnings | [lab asset](schema-validator-labs_research_production-ai-evaluation-harness.png) |

The practice template (`/what-we-do/engineering`) has the same nodes as the offer (WebPage, BreadcrumbList, Service). Its run was cut off when the validator began answering this network with HTTP 429 and a CAPTCHA, and it was not retried.

## Google Rich Results Test

Not run from here. Google rate-limited this network with a CAPTCHA, which automation must not bypass. The only rich result these pages can earn today is breadcrumbs: FAQ rich results ended on 7 May 2026, and Service, WebPage and Organization have no rich result. Run it after launch on live URLs (LAUNCH.md §4), together with URL Inspection.

## In CI

Every page's JSON-LD is validated on every pull request by `pnpm seo:check` (`apps/web/src/features/seo/json-ld-rules.ts`): zod shapes per type, unique and resolvable `@id`s, canonical-origin URLs, the WebPage named after the visible h1, FAQ questions visible on the page, and no Review, AggregateRating, HowTo, LocalBusiness, Offer or SearchAction.
