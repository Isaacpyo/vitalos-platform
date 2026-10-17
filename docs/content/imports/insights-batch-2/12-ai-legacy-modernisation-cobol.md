---
title: "Where AI helps with legacy modernisation, and where it still doesn't"
slug: ai-legacy-modernisation-cobol
format: Insight article
authors: [Vitalos]
publish_date: 2026-03-10
topics: [Software and platforms, Digital transformation]
sectors: [Health & Care, "Retail, Commerce & Consumer", "Operations, Industry & Logistics", Growth & Technology]
practice: Engineering
featured: false
excerpt: "AI can now read COBOL faster than any consultant alive. That makes legacy modernisation cheaper to start. It does not make migration easy. Here is where the line sits."
seo_title: "AI legacy modernisation: what it can and can't do"
seo_description: "AI legacy modernisation makes COBOL discovery far cheaper, but code translation is not system migration. Where AI helps, and where it does not."
focus_keyword: AI legacy modernisation
secondary_keywords: [COBOL modernisation, mainframe migration, legacy code AI, application modernisation, code translation]
cta_label: Talk to Vitalos
cta_href: /contact
reading_minutes: 5
---

On 23 February, the market gave legacy modernisation a jolt. After Anthropic published a post on using its AI coding tools to modernise COBOL, IBM's share price fell 13% in a day, reportedly its worst single-day fall in 25 years, with other big services firms also sliding ([Zuci Systems](https://www.zucisystems.com/blogs/legacy-modernization-in-the-ai-era-what-ibms-30b-week-taught-me/)).

Investors clearly believe AI legacy modernisation is about to change the economics of old software. They are partly right. But anyone who has actually moved a core system off a mainframe knows the code was never the hardest part.

So let us separate what AI really changes from what it does not.

## Where AI is a step change

**Understanding old systems.** This is the big one. Legacy estates are often undocumented, written by people who retired years ago, and full of business rules nobody remembers agreeing to. Reading them used to take months of expensive specialist time. AI models can now trace entry points, explain what a program does in plain English, map data flows and flag dead code in a fraction of that time.

That matters because discovery cost has been one of the main reasons organisations kept postponing modernisation. If understanding the system costs a fraction of what it did, the business case for starting looks very different.

**Generating tests.** You cannot safely change a system you cannot test. AI is very good at producing characterisation tests that capture what the old code does today, quirks and all. Those tests become the safety net for everything that follows.

**Translating code.** AI can convert COBOL, old Java or Visual Basic into modern languages far faster than manual rewriting. The output still needs review, but the first draft arrives in hours rather than months.

## Where AI does not change the hard parts

**Data migration.** Decades of data, stored in formats that made sense in 1987, with duplicates, workarounds and fields that mean different things depending on the year. Moving it accurately is still painstaking engineering and business validation. AI helps with profiling and mapping. It does not make the decisions.

**Behaviour, not syntax.** A translated program can compile perfectly and still behave differently: different rounding, different date handling, different transaction ordering. Code translation is not system migration. You have to define what "the same" means, in outputs, edge cases and performance, before you start, and prove it at the end.

**Cut-over.** Switching a live system that runs payroll, claims or orders is a business event, not a technical one. Parallel running, rollback plans and the timing of the switch are still human decisions with real consequences.

**Undocumented rules.** AI can tell you what the code does. It cannot tell you whether the business still wants it to. Some of those odd rules are critical regulatory logic. Some are fixes for a problem that disappeared a decade ago. Only people who understand the business can say which is which.

## A sensible way to use AI on legacy

The approach we recommend looks like this. Use AI-assisted discovery to map the estate first: entry points, dependencies, data flows and business rules. Then decide what to retire, what to keep, what to rebuild and what to translate. Run code translation and data migration as separate streams with their own teams, risks and timelines. Define behavioural equivalence early and test against it relentlessly. And sequence the work by risk, starting with loosely coupled modules before touching the critical transaction paths.

None of this is new advice. What is new is that the first and most expensive step, understanding what you have, is now dramatically cheaper. That should prompt a lot of organisations to revisit modernisation plans they shelved as unaffordable.

## The real opportunity

The market reaction in February was a signal, but not the one some people read into it. Legacy systems are not about to vanish overnight. What has changed is that the excuse for not starting has weakened. For many organisations, the right move this year is a focused assessment: what do we have, what does it really do, and what would it cost now to change it?

That is exactly the question our [Technology Health Assessment](/contact) is designed to answer, with AI doing the heavy reading and experienced engineers making the calls that matter.

## Frequently asked questions

### Can AI convert COBOL to Java or other modern languages?

Yes. AI models can translate COBOL into modern languages quickly, but the output still needs review, testing against the original behaviour and a separate plan for data migration and cut-over.

### What is the hardest part of legacy modernisation?

Usually data migration, proving behavioural equivalence and cutting over a live system safely. Code translation is typically the more manageable part.

### How does AI help with legacy system discovery?

AI can read legacy code, explain what it does, map data flows and dependencies, and identify business rules much faster than manual analysis.

## Sources

1. [Legacy modernization in the AI era: what IBM's $30B week taught me — Zuci Systems](https://www.zucisystems.com/blogs/legacy-modernization-in-the-ai-era-what-ibms-30b-week-taught-me/)
