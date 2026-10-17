# Vitalos Insights — batch 2 (20 articles)

Prepared 16 October 2026. One Markdown file per article. The YAML front matter maps to the CMS post fields (title, slug, format, authors, publish_date, topics, sectors, practice, featured, excerpt, seo_title, seo_description, cta_label, cta_href, reading_minutes). `focus_keyword` and `secondary_keywords` are for SEO reference only. The body starts after the front matter. Each article ends with a FAQ section (ready for FAQ schema) and a Sources list.

Author on all 20: **Vitalos**. Before importing, create the "Vitalos" author in Insights → Authors (see the note on the real-person check below).

| Publish date | File | Format | Focus keyword |
|---|---|---|---|
| 2025-09-17 | 02-agent-washing-how-to-spot-a-real-ai-agent.md | Point of view | agent washing |
| 2025-10-14 | 16-nhs-single-patient-record-interoperability.md | Executive briefing | NHS single patient record |
| 2025-11-25 | 05-how-to-evaluate-ai-systems-before-production.md | Guide | AI evaluation |
| 2026-01-13 | 09-post-quantum-cryptography-migration-ncsc-timeline.md | Guide | post-quantum cryptography migration |
| 2026-02-05 | 19-uk-ai-adoption-dsit-research.md | Point of view | UK AI adoption |
| 2026-02-24 | 18-ai-in-logistics-uk-multi-site.md | Insight article | AI in logistics |
| 2026-03-10 | 12-ai-legacy-modernisation-cobol.md | Insight article | AI legacy modernisation |
| 2026-04-22 | 11-software-supply-chain-security-npm-attacks.md | Engineering note | software supply chain security |
| 2026-04-29 | 20-cloud-waste-ai-costs-digital-sovereignty.md | Insight article | cloud waste |
| 2026-05-14 | 04-ai-agent-security-prompt-injection-mcp.md | Engineering note | AI agent security |
| 2026-06-03 | 17-agentic-commerce-uk-retailers.md | Executive briefing | agentic commerce |
| 2026-06-16 | 01-ai-agents-pilot-to-production.md | Executive briefing | AI agents in production |
| 2026-07-08 | 14-ai-data-readiness.md | Insight article | AI data readiness |
| 2026-07-21 | 10-ai-coding-tools-software-delivery-quality.md | Insight article | AI coding tools |
| 2026-08-04 | 07-eu-ai-act-digital-omnibus-uk-businesses.md | Executive briefing | EU AI Act |
| 2026-08-26 | 15-nhs-federated-data-platform-business-case-lessons.md | Executive briefing | NHS Federated Data Platform |
| 2026-09-22 | 13-disposable-software-short-lived-applications.md | Point of view | disposable software |
| 2026-09-29 | 03-ai-inference-costs-finops.md | Insight article | AI inference costs |
| 2026-10-07 | 06-ai-agent-accountability-governance.md | Point of view | AI accountability |
| 2026-10-12 | 08-cyber-security-and-resilience-bill-managed-service-providers.md | Executive briefing | Cyber Security and Resilience Bill |

Checks passed on every file: SEO title ≤ 60 characters, SEO description ≤ 155, excerpt ≤ 220; the focus keyword appears in the SEO title, SEO description and opening; no banned brand words or exclamation marks; every internal `/insights/...` link points to an article in this batch dated earlier; no article cites a source published after its own date.

Notes before publishing:

1. **Author "Vitalos" and the CMS rules.** The Insights build requires each author to be a confirmed real person, and the approved editorial note says every substantive Insight has a named human author. To publish under "Vitalos", either relax that check for an organisation author or change the editorial note.
2. **Backdated publish dates.** The CMS sets `first_published_at` when you press Publish. Use the scheduling/date override (or seed `first_published_at` directly) so these dates show. Eleven of the articles will be dated before the "Introducing Vitalos" launch post, so consider backdating that one to September 2025 too.
3. **Time-sensitive items.** Article 08 (Cyber Bill) says report stage is scheduled for 26 October 2026; recheck after that date. Article 07 is a summary, not legal advice, and says so.
4. **Calls to action** link to `/contact`. Swap in offer pages (for example an AI Opportunity Assessment page) once they exist.
