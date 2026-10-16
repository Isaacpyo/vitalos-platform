---
title: "You now pay per decision, not per seat: getting control of AI inference costs"
slug: ai-inference-costs-finops
format: Insight article
authors: [Vitalos]
publish_date: 2026-09-29
topics: [AI and agents, Cloud and reliability]
sectors: [Growth & Technology, "Retail, Commerce & Consumer", Health & Care, "Operations, Industry & Logistics"]
practice: AI & Data
featured: false
excerpt: "AI costs scale with every model call, retry and agent loop. Gartner expects most large firms to put FinOps controls at the point of inference by 2028. Here is how to start now."
seo_title: "AI inference costs: FinOps for AI agents"
seo_description: "AI agent costs scale per decision, not per seat. How to budget, attribute and cap AI inference costs, and defend against cost exhaustion attacks."
focus_keyword: AI inference costs
secondary_keywords: [AI FinOps, AI cost management, LLM costs, cost exhaustion attack, AI agent costs]
cta_label: Talk to Vitalos
cta_href: /contact
reading_minutes: 5
---

For twenty years, software costs were comfortably predictable. You bought licences per user, multiplied by headcount and put the number in the budget. If the team grew, the bill grew. Simple.

AI breaks that model. With language models and agents, you pay for usage: every prompt, every response, every tool call, every retry. An agent that gets confused and loops ten times costs ten times as much. A feature that customers love can double its running cost in a month. A feature nobody uses can still sit on expensive infrastructure.

You are no longer paying per seat. You are paying per decision, and AI inference costs, the price of every model call, now behave more like a utility bill than a licence.

## The analysts have noticed

Gartner's latest strategic predictions, published on 15 September, put numbers on where this is heading ([Gartner](https://www.gartner.com/en/newsroom/press-releases/2026-09-15-gartner-unveils-top-strategic-predictions-for-2027-and-beyond)):

- By 2028, **60% of Global 500 companies** will embed AI FinOps controls at the point of inference, shifting cost governance to real-time optimisation.
- By 2029, **60% of organisations deploying AI** will set up a dedicated function to map the total cost of AI to its value.
- By 2030, **80% of organisations with public-facing AI** will have experienced a **cost exhaustion attack**, where attackers deliberately drive up AI usage to inflate costs.

That last one deserves a pause. Attackers no longer need to steal your data to hurt you. They can simply make your AI expensive to run.

## Why AI costs are hard to see

Most organisations can tell you their total AI spend. Far fewer can tell you what a single customer conversation, document review or agent task costs, or which team, product or customer drove last month's increase.

That is because AI costs hide in several places at once: model API bills, cloud compute, vector databases, data pipelines and the engineering time spent tuning it all. And in agentic systems, cost depends on behaviour. The same request might take two model calls or twenty, depending on how the agent reasons its way through it.

## Five controls to put in place now

You do not need to wait until 2028. A handful of controls make AI costs visible and manageable today.

**Measure cost per task.** Pick the unit that matters to the business, such as a resolved ticket, a processed claim or a completed order, and report what each one costs in AI spend. It is the single most useful number for deciding whether a use case is worth scaling.

**Attribute every call.** Tag every model call with the product, feature, team and, where appropriate, customer that triggered it. Without attribution, cost conversations turn into guesswork.

**Set budgets and hard limits.** Give each agent and feature a budget, with alerts as it approaches the limit and a hard stop for runaway loops. Cap the number of steps an agent can take on a single task.

**Route to the right model.** Not every question needs the largest, most expensive model. Route simple tasks to smaller, cheaper models and reserve the heavy ones for work that needs them. Cache repeated answers.

**Defend the front door.** For public-facing AI, apply rate limits per user and per session, detect unusual usage patterns and require authentication for expensive operations. Treat a sudden spike in usage as a potential attack, not just good news.

## Cost is a design decision

The biggest savings rarely come from negotiating a better rate with a model provider. They come from design. A well-scoped agent with clear instructions, good tools and a sensible step limit can cost a fraction of a loosely designed one doing the same job. Shorter prompts, better retrieval and fewer unnecessary calls compound quickly at scale.

This is why cost belongs in the same conversation as accuracy and safety when you [evaluate an AI system before go-live](/insights/how-to-evaluate-ai-systems-before-production). A system that is accurate but unaffordable at scale is not ready for production.

## Linking cost to value

Gartner's prediction of a dedicated cost-to-value function points at the real goal. The question is not "how do we spend less on AI?" It is "is each pound of AI spend producing more than a pound of value?" Some use cases will justify much higher spend. Others will not survive an honest look.

Organisations that can answer that question, use case by use case, will scale the right things confidently. The rest will either overspend quietly or cut blindly when the bill arrives. For a related look at where cloud budgets leak, see our piece on [cloud waste and AI costs](/insights/cloud-waste-ai-costs-digital-sovereignty).

If your AI bill is growing faster than your understanding of it, our AI & Data and Managed Services teams can help you [put the controls in place](/contact).

## Frequently asked questions

### What is AI FinOps?

AI FinOps applies financial operations practices to AI: making AI costs visible, attributing them to products and teams, setting budgets and optimising spend against the value delivered.

### What is a cost exhaustion attack?

A cost exhaustion attack is when an attacker deliberately drives up usage of an organisation's AI services to inflate its costs. Gartner predicts 80% of organisations with public-facing AI will experience one by 2030.

### How can I reduce AI inference costs?

Measure cost per task, attribute every call, set budgets and step limits, route simple tasks to smaller models, cache repeated answers and rate-limit public-facing services.

## Sources

1. [Gartner Unveils Top Strategic Predictions for 2027 and Beyond — Gartner, 15 September 2026](https://www.gartner.com/en/newsroom/press-releases/2026-09-15-gartner-unveils-top-strategic-predictions-for-2027-and-beyond)
