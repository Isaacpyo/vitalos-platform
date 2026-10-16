# SEO

Search, social and AI visibility for vitalos.co.uk (built 16 Oct 2026, PR #47, ADR-043).

| Document                           | What it is                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [AUDIT.md](AUDIT.md)               | Baseline and final crawls, findings by severity, legacy URL inventory                                 |
| [STRATEGY.md](STRATEGY.md)         | The entity, audiences, intents and topic pillars; proposed LinkedIn wording                           |
| [KEYWORD-MAP.md](KEYWORD-MAP.md)   | Every indexable URL: its topic, phrases, intent, title and links (one owner per phrase)               |
| [URL-RULES.md](URL-RULES.md)       | URL rules and the route inventory                                                                     |
| [CONTENT-PLAN.md](CONTENT-PLAN.md) | Gaps as proposals: sections, FAQs, Insights clusters                                                  |
| [REDIRECTS.md](REDIRECTS.md)       | Every redirect (308), 410s and legacy fragments                                                       |
| [REPORTING.md](REPORTING.md)       | The monthly checklist and the draft privacy wording for analytics                                     |
| [LAUNCH.md](LAUNCH.md)             | The pre-merge gate, the www → apex move, Search Console, Bing and monitoring (prepared, not executed) |
| [DECISIONS.md](DECISIONS.md)       | Every judgement call, with the reason                                                                 |
| [validation/](validation/)         | Schema Markup Validator results per template                                                          |

Code: `apps/web/src/features/seo/` (metadata, robots and crawler policy, sitemap index, JSON-LD graph and rules, Open Graph template, IndexNow, `llms.txt`) and `tooling/seo/` (crawler, Lighthouse budgets, `seo:check`, the IndexNow deploy ping).

Commands: `pnpm seo:check` (add `--lighthouse`, `--record <prefix>` or `--live <origin>`), `pnpm seo:crawl`, `pnpm seo:lighthouse`.
