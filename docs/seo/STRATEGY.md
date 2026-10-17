# SEO strategy

Owner: Vitalos. Status: Phase 1, 16 Oct 2026. Companion documents: [KEYWORD-MAP.md](KEYWORD-MAP.md), [URL-RULES.md](URL-RULES.md), [CONTENT-PLAN.md](CONTENT-PLAN.md), [REPORTING.md](REPORTING.md) and [LAUNCH.md](LAUNCH.md).

## 1. The entity

Search engines and AI assistants should understand Vitalos as a single, consistent entity:

| Field                                | Value (approved sources only)                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Name                                 | Vitalos                                                                                                                     |
| Category (descriptor, locked copy)   | Technology Consulting, Engineering & Digital Transformation                                                                 |
| One line (locked `propositionLong`)  | We help ambitious organisations modernise operations, build digital products and adopt AI.                                  |
| Longer description (About page SEO)  | A technology consulting, engineering and digital transformation company with AI at the centre, from strategy to production. |
| Market                               | United Kingdom first ("UK first, international by design", About)                                                           |
| Practices (the `knowsAbout` pillars) | Consulting, Engineering, AI & Data, Experience, Managed Services; plus Vitalos Labs                                         |
| Legal name and company number        | Vitalos Technologies Limited, 16696895 (Companies House, `packages/cms/src/repo/settings.ts`)                               |
| Public email                         | support@vitalos.co.uk                                                                                                       |
| Profiles (`sameAs`)                  | linkedin.com/company/vitalos, x.com/vitalos (owner direction, 15 Oct 2026)                                                  |
| Address                              | Not in markup. It appears only in the privacy notice (owner decision, 12 Oct 2026).                                         |

The name, the one line and the practice names are used word for word in titles, descriptions, Organization schema, Open Graph, `llms.txt` and the proposed LinkedIn "About" text (§7). One wording everywhere is what lets an engine merge mentions into one entity.

## 2. Audiences

From the brand narrative and the IA, Vitalos speaks to the leaders who own operations, technology and digital in its launch sectors:

1. **Operations and transformation leaders** (COO, Director of Operations, Transformation Director). They have manual, fragmented processes and want them redesigned, automated and integrated. They land on Business Process Modernisation, Business Process Automation and Systems Integration.
2. **Technology leaders** (CTO, CIO, Head of Engineering or Platform). They own an ageing, unstable or unfinished platform. They land on Application Modernisation, Technology Recovery & Reliability, Engineering Rescue, Technology Health Assessment and Managed Services.
3. **Digital and product leaders** (CDO, Head of Digital or Product). They need a new product, portal or customer journey. They land on Digital Product Transformation, Product Discovery, Custom Digital Product and Customer Experience Transformation.
4. **Executives with an AI mandate** (CEO, COO, CDO). They want value from AI without uncontrolled risk. They land on AI Transformation, AI Opportunity Assessment, AI Prototype Sprint and AI & Data.
5. **Founders and CTOs of startups and scale-ups** (selective Growth & Technology work). They need architecture, product engineering and AI.

Across these roles the launch sectors are Health & Care; Retail, Commerce & Consumer; Operations, Industry & Logistics; and, selectively, Growth & Technology. Procurement and security reviewers form a secondary audience; they use the Trust Centre and the legal pages.

## 3. Intents served

| Intent                                                   | Example query shape                                                                | Pages that serve it                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Commercial investigation: "who can build or modernise X" | "application modernisation", "legacy system modernisation UK", "AI consultancy UK" | Solutions, practices and the homepage                |
| Transactional: a bounded way to start                    | "technology health check", "AI readiness assessment", "product discovery workshop" | Offers                                               |
| Sector-qualified commercial                              | "healthcare software development UK", "logistics software development"             | Industries                                           |
| Informational: how to think about a problem              | "how to modernise a legacy application", "AI governance for SMEs"                  | Insights (PR #46; topic clusters in CONTENT-PLAN.md) |
| Navigational and brand                                   | "Vitalos", "Vitalos contact", "Vitalos careers"                                    | Homepage, About, Contact, Careers                    |
| Trust and due diligence                                  | "Vitalos security", "Vitalos privacy notice"                                       | Trust Centre and legal                               |

**Not served on purpose:** location pages ("{service} in {city}"), doorway pages, price-comparison pages and review aggregation. The integrity rule forbids them, and Vitalos has no offices to describe.

## 4. Topic pillars mapped to the IA

Each pillar has one hub and a fixed set of spokes. A phrase belongs to exactly one page (KEYWORD-MAP.md).

| Pillar (practice, the `knowsAbout` term)    | Hub                            | Solutions (problem-led spokes)                                                               | Offers (how to start)                                                                                        |
| ------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Technology consulting                       | `/what-we-do/consulting`       | All six (it leads discovery for each)                                                        | Digital Transformation Discovery, Technology Health Assessment, AI Opportunity Assessment, Product Discovery |
| Software engineering                        | `/what-we-do/engineering`      | Application Modernisation, Technology Recovery & Reliability, Digital Product Transformation | Custom Digital Product, Application Modernisation, Systems Integration, Engineering Rescue                   |
| AI and data                                 | `/what-we-do/ai-data`          | AI Transformation, Data & Intelligence Transformation                                        | AI Opportunity Assessment, AI Prototype Sprint, Data & BI Modernisation, Business Process Automation         |
| Experience (product, service and UX design) | `/what-we-do/experience`       | Digital Product Transformation, Business Process Modernisation                               | Product Discovery, Custom Digital Product, Customer Experience Transformation                                |
| Managed services                            | `/what-we-do/managed-services` | Technology Recovery & Reliability, Application Modernisation, AI Transformation              | Managed Engineering & Application Care                                                                       |

The four industries cut across all pillars: each industry page links to the solutions that apply to it (from the content relationships) and owns only its sector-qualified phrases. **Vitalos Labs** (`/labs`) supports the AI and engineering pillars with proof of method: research, frameworks and accelerators, each with a maturity label. **Insights** (PR #46) supplies the informational layer, and each article links to one solution or offer.

Linking model (Phase 2 builds it, Phase 5 checks it):

```
Home ─┬─ What We Do (hub of hubs) ─┬─ Practice ↔ Solution ↔ Offer
      │                            └─ How We Work
      ├─ Industries ── Industry → Solutions
      ├─ Labs ── Lab type ── Lab asset → Practice
      └─ Insights (when open) ── Article → Solution / Offer, Author
```

## 5. What success looks like (measured in REPORTING.md)

1. **Coverage.** Every indexable URL in the sitemap is indexed, and no preview or `vercel.app` URL is.
2. **Brand.** "Vitalos" returns vitalos.co.uk first, with sitelinks for What We Do, About and Contact.
3. **Pillars.** Impressions grow for each pillar's primary phrases, tracked per pillar in Search Console. No targets are set until there is real data (no invented volumes).
4. **AI visibility.** Bing AI Performance citations, and Vitalos named correctly (name, one line, practices) when assistants are asked about it.
5. **Conversions.** "Talk to Vitalos" clicks and enquiry submits from organic landings, attributed by landing page, with no personal data.
6. **Experience.** Core Web Vitals pass at p75 in the field (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1).

## 6. Principles

- People-first copy within the short-copy rules (`docs/design/`). Depth comes from genuine FAQs, Insights and case studies, never from padding service pages.
- One page per intent. A title states its topic plainly, with the brand last.
- Structured data repeats what is on the page, and nothing else.
- UK English throughout ("modernisation", "programme", "organisation").
- No invented numbers. Volumes and difficulty come only from Search Console, Bing Webmaster Tools or Keyword Planner; until then they are marked "to validate".

## 7. Proposed LinkedIn wording (for the owner; not published)

> **Vitalos** — Technology Consulting, Engineering & Digital Transformation.
> We help ambitious organisations modernise operations, build digital products and adopt AI. Six practices (Consulting, Engineering, AI & Data, Experience, Managed Services and Labs) share one delivery lifecycle, from strategy to production. UK first, international by design. vitalos.co.uk

Every sentence above already appears in approved site copy.
