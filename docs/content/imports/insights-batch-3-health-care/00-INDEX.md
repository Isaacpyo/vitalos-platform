# Vitalos Insights — batch 3: Health & Care (4 posts)

Prepared 25 October 2026 from the Vitalos Healthcare Website Build Pack (Part 4). Three posts are built from the healthcare research; one announces the launch. The copy is the owner's, word for word, in the house style of batch 2: YAML front matter, then the Markdown body, an FAQ section (FAQ structured data) and numbered Sources.

All four go into the Super Admin as **drafts**. Nothing is published by the import.

| File | Format | Topics | Sectors | Call to action |
| --- | --- | --- | --- | --- |
| 01-mhra-ai-scribe-guidance-clinic-admin.md | Executive briefing | AI and agents | Health & Care | Book a clinic admin audit → `/contact?intent=healthcare-audit` |
| 02-dtac-2026-nhs-suppliers.md | Executive briefing | Software and platforms | Health & Care | See NHS Assurance Readiness → `/offers/nhs-assurance-readiness` |
| 03-medical-delivery-software-chain-of-custody.md | Insight article | Software and platforms | Health & Care; Operations, Industry & Logistics | See Medical Logistics Digitisation → `/offers/medical-logistics-digitisation` |
| 04-vitalos-health-care-practice.md | News | Digital transformation | Health & Care | Apply as a design partner → `/contact?intent=healthcare-partner` |

Author on all four: **Vitalos** (the organisation author, byline "Vitalos Insights").

## Importing

```
# Dry run: checks every file, writes nothing.
manage.py import_insights_batch apps/insights/imports/insights-batch-3-health-care --status draft
# Create the four drafts.
manage.py import_insights_batch apps/insights/imports/insights-batch-3-health-care --apply --status draft
```

The admin must run migration `insights.0004_post_format_news` first (the News format). Preview each draft from the admin (Insights › Posts › Preview) and upload a cover in Insights › Posts › Cover (`insights.article.{slug}` in `docs/design/IMAGE-SLOTS.md`).

## To confirm before publishing

1. **Topics.** The import needs at least one topic and one sector per post. Posts 3 and 4 name only sectors in the brief, so they carry **Software and platforms** (post 3) and **Digital transformation** (post 4). Change them in the admin if you prefer another topic.
2. **Dates and the quote.** Every file carries `publish_date: 2026-10-24` only because the import requires a past date; it is not used for a draft. Set each post's date when you approve and publish it (post 4: "set on approval"). The founder quote is a visible `[confirm: a founder quote from Temitope Agbola]` placeholder.
3. **Facts.** Re-check each post against its sources on publishing day (dates, version numbers, deadlines).
4. **Order.** Publish the Health & Care page and offers first, then the news post, then one briefing a week. The lead page links the MHRA briefing (post 1) only once it is published.
5. **Practice.** Each post is filed under one practice: post 1 AI & Data, post 2 Consulting, post 3 Engineering, post 4 Consulting.
