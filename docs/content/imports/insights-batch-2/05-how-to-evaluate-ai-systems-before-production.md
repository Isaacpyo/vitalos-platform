---
title: "Demo or dependable? How to evaluate an AI system before it goes live"
slug: how-to-evaluate-ai-systems-before-production
format: Guide
authors: [Vitalos]
publish_date: 2025-11-25
topics: [AI and agents, Data]
sectors: [Health & Care, "Retail, Commerce & Consumer", "Operations, Industry & Logistics", Growth & Technology]
practice: AI & Data
featured: false
excerpt: "Every AI demo looks good. The question is whether it still looks good on the 500th real case, at 2am, with messy data. A practical method for evaluating AI before production."
seo_title: "AI evaluation: test an AI system before production"
seo_description: "A practical AI evaluation method: golden test sets, failure taxonomies, agreed thresholds and monitoring, so your AI pilot is ready for production."
focus_keyword: AI evaluation
secondary_keywords: [evaluate AI system, LLM evaluation, AI pilot to production, AI testing, golden dataset]
cta_label: Talk to Vitalos
cta_href: /contact
reading_minutes: 5
---

Here is a familiar meeting. Someone shares their screen, types a question into a shiny new AI assistant, and the answer comes back fluent, fast and correct. The room nods. Someone says "imagine what this could do across the whole business". A budget appears.

Six months later, the same system is quietly switched off.

What happened in between was not a technology failure. It was an AI evaluation failure. The demo answered one question well. Nobody checked how it handled the other ten thousand. Gartner expects more than 40% of agentic AI projects to be cancelled by the end of 2027, with unclear business value and inadequate risk controls among the reasons ([Outlook Business, reporting Gartner](https://www.outlookbusiness.com/artificial-intelligence/over-40-of-agentic-ai-projects-will-be-scrapped-by-2027-says-gartner)). Both are evaluation problems in disguise.

This guide sets out the method we use to move AI from "promising" to "proven".

## Step 1: Define the job in one sentence

Before you test anything, write down the job the system is meant to do, who relies on the output and what happens when it is wrong. "Summarise inbound customer complaints so the team can route them within an hour" is a job. "Use AI on customer service" is a wish.

That sentence decides everything that follows: which cases matter, which mistakes are tolerable and which are not.

## Step 2: Build a golden set from real work

A **golden set** is a collection of real examples with known good answers. Pull them from actual tickets, documents, orders or records, not from what the team imagines users might ask. Aim for a few hundred cases to start, deliberately including the awkward ones: the incomplete form, the angry email, the edge case your best operator handles by instinct.

Have the people who do the work today mark up what "good" looks like. Their judgement is the benchmark. If they disagree with each other, you have learned something important about the task before writing a line of code.

## Step 3: Name the ways it can fail

Accuracy is not one number. A system that is 92% "correct" might be making harmless formatting slips or might be confidently inventing refund amounts. Those are not the same.

Build a simple **failure taxonomy** for your task. For most business systems it includes factual errors, missing information, wrong actions, unsafe or off-policy responses, and failures to say "I don't know". Score each case against it. Suddenly the conversation moves from "it's quite good" to "it never gets the policy wrong, but it misses attachments 8% of the time", which is something you can fix.

## Step 4: Agree the thresholds before you see the results

This is the step most teams skip, and it is the one that saves projects. Agree with the business owner, in writing, what level of performance is good enough to go live, and what must never happen. For example:

- No more than 2% of cases with a factual error, and zero involving money or clinical information.
- Every case below a confidence threshold routed to a person.
- Cost per completed task below an agreed figure.

Setting the bar first stops everyone moving it once the results come in. It also turns the go-live decision from a debate into a check.

## Step 5: Put people in the loop, then measure them too

Human review is not a failure of automation. In the early weeks it is how you learn. Have reviewers check a sample of live outputs, record what they change and feed those corrections back into your golden set.

Measure the reviewers as well. If they are approving 99% of outputs in three seconds each, they are not reviewing. They are clicking. That tells you either the system is ready for less oversight, or the review design needs work.

## Step 6: Treat every change as a regression risk

Language models change. Prompts change. Data changes. A system that passed in March can quietly degrade in May. Run your golden set automatically whenever anything changes, the same way engineers run tests before releasing code. If the scores drop, nothing ships.

## Step 7: Keep evaluating in production

Offline tests tell you whether a system is ready. Only production tells you whether it is working. Track the measures that matter to the business, such as resolution time, rework rate, escalations and cost per task, alongside technical signals like latency and error rates. Review them on a fixed rhythm with a named owner.

This is the bit that turns a pilot into a service. It is also why our approach to AI runs in stages: assess, prototype, move into production, then manage. Each stage has to earn the next, and evaluation is the evidence that it has.

## The payoff

Good evaluation feels slower at the start. It is not. It replaces months of arguing about whether "it works" with a clear, shared answer. It catches the expensive failures before customers do. And it gives leaders something they rarely get from AI projects: a reason to say yes with confidence.

If you have an AI pilot that looks promising but has not yet earned a production decision, that is exactly the gap our [AI Prototype Sprint and evaluation work](/contact) is built to close.

## Frequently asked questions

### What is a golden set in AI evaluation?

A golden set is a collection of real examples with agreed correct answers, used to test an AI system consistently before and after every change.

### How many test cases do you need to evaluate an AI system?

A few hundred well-chosen real cases is a sensible starting point for most business tasks, as long as they include difficult and unusual examples, not just typical ones.

### Why do AI pilots fail to reach production?

Common reasons include unclear business value, weak risk controls and no agreed definition of "good enough". A structured evaluation addresses all three.

## Sources

1. [Over 40% of Agentic AI Projects Will Be Scrapped by 2027, Says Gartner — Outlook Business, 25 June 2025](https://www.outlookbusiness.com/artificial-intelligence/over-40-of-agentic-ai-projects-will-be-scrapped-by-2027-says-gartner)
