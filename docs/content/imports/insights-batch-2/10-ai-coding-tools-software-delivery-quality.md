---
title: "Faster, and more broken: what AI coding tools are doing to software delivery"
slug: ai-coding-tools-software-delivery-quality
format: Insight article
authors: [Vitalos]
publish_date: 2026-07-21
topics: [Software and platforms, AI and agents]
sectors: [Growth & Technology, "Retail, Commerce & Consumer", Health & Care, "Operations, Industry & Logistics"]
practice: Engineering
featured: false
excerpt: "Teams using AI coding tools heavily ship more work, but bugs per pull request are up 29% and review times have grown fivefold. How to keep the speed without the breakage."
seo_title: "AI coding tools: faster delivery, more bugs?"
seo_description: "AI coding tools lift throughput, but data from 22,000 developers shows more bugs, incidents and review time. What engineering leaders should change."
focus_keyword: AI coding tools
secondary_keywords: [AI-assisted development, developer productivity AI, code quality AI, code review bottleneck, engineering metrics]
cta_label: Talk to Vitalos
cta_href: /contact
reading_minutes: 5
---

Every engineering leader has seen the slide. AI coding tools, it says, make developers dramatically more productive. Ship twice as fast. Do more with the same team.

Some of that is true. The question nobody put on the slide is what happens to everything after the code is written.

Faros AI's engineering report, *The Acceleration Whiplash*, offers one of the more detailed answers so far. Based on telemetry from roughly 22,000 developers across 4,000 teams, it compares teams with high and low AI adoption ([Faros AI](https://www.faros.ai/research/ai-acceleration-whiplash)). The headline: output goes up, and so do problems.

## What goes up

The throughput gains are real. High-adoption teams completed **66% more epics** and **34% more tasks**, and merged 16% more pull requests.

So far, so slide-friendly.

## What goes up faster

Then the other numbers. Pull request size rose **51%**. Bugs per pull request rose **29%**, and bugs per developer by 54%. Incidents per pull request rose roughly **threefold**, and monthly incidents by 58%. Median review time increased around **fivefold**. And deployments per week actually fell by about 12%.

Read together, the story is clear. AI helps people write more code, in bigger chunks, faster. That code lands on reviewers, testers and production systems that have not sped up at all. The bottleneck moves downstream, and quality pays the price.

A fair caveat: Faros sells engineering analytics, the full methodology sits behind a form, and the report presents a statistically significant relationship rather than proof of cause and effect. But the pattern matches what many engineering teams describe privately, and it is worth taking seriously.

## Why this happens

AI coding tools are excellent at producing plausible code. They are less good at knowing your system's history, your unwritten conventions or the strange customer edge case that broke production two years ago. Developers using them feel faster, and often are. But larger changes are harder to review properly, and reviewers facing a growing queue start skimming.

Meanwhile, the measures most teams track, such as tickets closed and pull requests merged, reward exactly the behaviour that creates the problem. If you celebrate volume, you get volume.

## How to keep the speed without the breakage

The answer is not to ban the tools. It is to redesign the system around them.

**Keep changes small.** Large pull requests are the root of much of the damage. Set a soft limit on change size and ask for big pieces of work to be split. Small changes are faster to review, easier to test and simpler to roll back.

**Invest in review capacity.** If AI multiplies the code written, review has to scale too. That might mean dedicated review time in every sprint, pairing on high-risk changes or using AI reviewers as a first pass, as a quarter of pull requests in the Faros data already are, while keeping a human accountable for the merge.

**Make tests the gate.** Automated tests, static analysis and security scanning should block merges, not just report on them. AI is also good at writing tests. Ask for tests with every change, generated or not.

**Measure outcomes, not output.** Track change failure rate, time to restore service and incidents alongside throughput. If your dashboard shows only how much was shipped, you will not see the whiplash until customers do.

**Write down the context.** Architecture decisions, conventions and known pitfalls, written where both people and AI tools can read them, cut a surprising number of avoidable mistakes.

## The real productivity gain

The organisations getting the most from AI-assisted development are not the ones writing the most code. They are the ones that use the speed to do more of the valuable things: more testing, more refactoring, smaller and safer releases, and faster fixes.

That is a leadership choice, not a tooling one. Used well, AI coding tools can make software both faster and better. Left alone, the evidence suggests they make it faster and worse.

At Vitalos, AI is part of how our engineers deliver every day, with the review and testing discipline to match. If your teams have adopted AI tools and your incident graph has started climbing, we can help you [find and fix the bottleneck](/contact). For a related risk in the same pipelines, see our note on [software supply chain security](/insights/software-supply-chain-security-npm-attacks).

## Frequently asked questions

### Do AI coding tools increase developer productivity?

Faros AI's telemetry found high-adoption teams completed 34% more tasks and 66% more epics, so output does increase.

### Do AI coding tools increase bugs?

The same data found bugs per pull request rose 29% and incidents per pull request roughly tripled in high-adoption teams, alongside a fivefold increase in median review time.

### How can teams use AI coding tools without hurting quality?

Keep changes small, scale review capacity, make automated tests a merge gate, measure stability as well as throughput and document system context.

## Sources

1. [The Acceleration Whiplash: AI Engineering Report — Faros AI, Q2 2026](https://www.faros.ai/research/ai-acceleration-whiplash)
