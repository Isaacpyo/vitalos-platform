# Content plan (proposals only)

These are gaps the keyword map shows. **Nothing here is written or published by this branch.** Each item needs an owner decision, and every Insight needs a named human author (`docs/content/BRIEF.md`). All proposals stay within the short-copy rules (`docs/design/`): depth goes into FAQs, Insights and case studies, not into longer service pages.

## 1. Sections to add (within the copy rules)

| Page           | Gap                                                                             | Proposal                                                                                                                    | Why it matters                                                         |
| -------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Practices (5)  | Not one practice page says who it is for.                                       | One line under the proposition: "For {roles} who {problem}." Use the audience roles in STRATEGY.md §2.                      | AI answers and snippets quote a plain "who it's for" line (Phase 4).   |
| Offers (13)    | The duration or shape of the engagement appears only in the engagement summary. | Keep the copy as it is; make sure the summary's first line says what you get and how it starts. Pricing stays proposal-led. | It answers "what do I get" near the top, for searchers and assistants. |
| Industries (4) | No sector-specific questions.                                                   | A "Common questions" block of 3 to 4 genuine questions per industry, using the existing solution FAQ pattern.               | It covers sector-qualified searches without a doorway page.            |
| `/offers`      | The index lists offers but says nothing on how to choose between them.          | One sentence per group: "Not sure where to start? Assessments", "Ready to build? Delivery", "Live system? Managed".         | Internal links with descriptive anchors; helps people choose.          |
| `/how-we-work` | The lifecycle stages have no anchors that search engines can link to.           | Stable `id`s on each stage heading (they are already in the anchored stage list).                                           | Deep links such as `/how-we-work#discover` for Insights.               |

## 2. Genuine FAQs per service page

The solution pages already show "Common questions" (from `faq` in the content). Practices and offers have none. Proposed questions follow; the **answers must come from the owner or from existing approved copy**. None is drafted here.

**Practices**

- Consulting: "Do you only advise, or do you also deliver?" · "What do we get at the end of a consulting engagement?" · "How long does an assessment take?"
- Engineering: "Can you work with our existing team and codebase?" · "How do you hand over what you build?" · "Which technologies do you use?"
- AI & Data: "How do you decide whether AI is worth it?" · "How do you govern AI in production?" · "What if our data is not ready?"
- Experience: "Do you design and build, or design only?" · "How do you make services accessible?"
- Managed Services: "Will you support a system you did not build?" · "What does a takeover assessment involve?" · "What are your support hours?" (the answer only if it is defined)

**Offers** (two each, drawn from what the page already states)

- "What do I receive at the end?" (already the "What you receive" list, phrased as a question and answer)
- "What do you need from us?" (already the "What we need from you" list)

Rendering rule: a FAQ is marked up as FAQPage only where its questions and answers are visible on that page and nowhere else (DECISIONS 8).

## 3. Insights topic clusters per pillar (working titles)

Each article answers one informational question, links to one solution or offer, and needs a named author with a profile. Working titles only; they are not commitments and not drafted.

| Pillar                | Cluster                                  | Working titles                                                                                                                                                                                       | Links to                                                           |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Technology consulting | Planning a transformation                | "How to scope a digital transformation discovery" · "Current state, future state, roadmap: what each should contain" · "Signs your technology strategy is really a wish list"                        | Digital Transformation Discovery                                   |
| Software engineering  | Legacy systems                           | "Refactor, replace or retire: choosing an application modernisation path" · "Modernising in stages without a big-bang rewrite" · "What a technology health assessment actually checks"               | Application Modernisation (solution), Technology Health Assessment |
| Software engineering  | Rescue and reliability                   | "When to stop and stabilise a failing software project" · "Taking over a system someone else built"                                                                                                  | Engineering Rescue, Technology Recovery & Reliability              |
| AI and data           | Production AI                            | "From AI pilot to production: the gaps that stall programmes" · "Evaluating AI systems before and after launch" (links to the Labs evaluation harness) · "AI governance for mid-sized organisations" | AI Transformation, AI Prototype Sprint                             |
| AI and data           | Data foundations                         | "Is your data ready for AI? A practical readiness check" · "Modernising reporting without rebuilding everything"                                                                                     | AI Opportunity Assessment, Data & BI Modernisation                 |
| Experience            | Product discovery                        | "What product discovery should produce before you build" · "Designing accessible services from the start"                                                                                            | Product Discovery, Customer Experience Transformation              |
| Managed services      | Running live systems                     | "What good application care looks like" · "Planning support for a system you are about to launch"                                                                                                    | Managed Engineering & Application Care                             |
| Industries            | Sector briefings (one per launch sector) | "Modernising operations in {Health & Care / Retail / Logistics}: where to start"                                                                                                                     | The industry page and one solution                                 |

Rules carried from the brief: no invented statistics, clients or outcomes; each article is reviewed against the integrity rule before publishing; each targets a question no service page targets (KEYWORD-MAP.md); and each Insight is published through the Super Admin (PR #46), which pings IndexNow.

## 4. Case studies

`/work` is gated until two approved case studies exist. When they do, each is an Article (no client name unless approved) and links to its solution, offer and industry. Write them in the problem → approach → evidence shape. Each case study is the strongest single piece of proof a service page can link to.
