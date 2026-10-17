---
title: "Post-quantum cryptography: the NCSC's 2028 deadline is closer than it looks"
slug: post-quantum-cryptography-migration-ncsc-timeline
format: Guide
authors: [Vitalos]
publish_date: 2026-01-13
topics: [Cloud and reliability, Software and platforms]
sectors: [Health & Care, "Retail, Commerce & Consumer", "Operations, Industry & Logistics", Growth & Technology]
practice: Engineering
featured: false
excerpt: "Quantum computers that break today's encryption may be years away. The NCSC's deadline to know where your cryptography lives is 2028. Here is how to start without boiling the ocean."
seo_title: "Post-quantum cryptography migration: NCSC timeline"
seo_description: "Post-quantum cryptography migration: the NCSC wants discovery by 2028 and full migration by 2035. How to start on inventory, suppliers and agility."
focus_keyword: post-quantum cryptography migration
secondary_keywords: [NCSC PQC timeline, quantum-safe encryption, cryptographic inventory, crypto agility, harvest now decrypt later]
cta_label: Talk to Vitalos
cta_href: /contact
reading_minutes: 5
---

Quantum computing has a branding problem. It sounds like science fiction, so it gets filed under "later". Meanwhile, the UK's National Cyber Security Centre has quietly put dates on the calendar, and the first one is only two years away.

The NCSC's timeline for **post-quantum cryptography migration** (PQC migration) is clear. By **2028**, organisations should have defined their migration goals, completed discovery of which systems depend on cryptography, and built an initial migration plan. By **2031**, the highest-priority migrations should be done. By **2035**, migration of all systems, services and products should be complete ([NCSC](https://ncsc.gov.uk/guidance/pqc-migration-timelines)).

Ten years sounds generous. It is not, once you see how much of your estate quietly relies on encryption.

## Why this cannot wait for the quantum computer

The worry is not just that a future quantum computer could break the public-key cryptography protecting today's systems. It is that adversaries can collect encrypted data now and decrypt it later, once the capability exists. Security people call this "harvest now, decrypt later".

If your organisation holds data that still needs to be confidential in ten or fifteen years, such as health records, contracts, intellectual property or long-term customer data, then today's traffic is already exposed to that future risk.

The good news is that the replacement algorithms exist. In August 2024 the US National Institute of Standards and Technology finalised its first post-quantum standards, including ML-KEM for key establishment and ML-DSA for digital signatures. The work now is not invention. It is migration, and migration is where large organisations historically struggle.

## Step one: find out where your cryptography lives

The NCSC's 2028 milestone is mostly about discovery, and for good reason. Most organisations cannot answer a simple question: where do we use cryptography, and which kind?

The honest answer is "everywhere". TLS on websites and APIs. VPNs. Code signing. Single sign-on tokens. Database encryption. Backups. Payment terminals. Hardware security modules. Embedded devices on a warehouse floor that nobody has updated in years. Libraries buried three layers deep in applications you bought rather than built.

A useful **cryptographic inventory** records, for each system, which algorithms and key lengths are in use, where keys are generated and stored, who owns the system and how long the data it protects needs to stay secret. Automated scanning of code, certificates and network traffic will find a lot of it. Interviews and architecture reviews find the rest.

## Step two: talk to your suppliers now

A large share of your cryptography is not yours. It sits inside cloud platforms, SaaS products, network appliances and devices. The NCSC explicitly calls out supplier dependencies and asks organisations to tell suppliers what they need.

Start by asking three questions of every critical supplier:

- What is your post-quantum roadmap, with dates?
- Which of your products will need replacing rather than updating?
- How will you notify us when PQC options become available?

Their answers will shape your plan more than any internal work. A supplier with no roadmap is a risk you need to know about in 2026, not 2033.

## Step three: build crypto agility into everything new

The cheapest migration is the one you design out. Any system you build or buy from now on should be **crypto agile**: able to swap algorithms through configuration rather than a rewrite. That means avoiding hard-coded algorithms, centralising key management and keeping cryptographic libraries up to date.

This is a simple rule to add to architecture reviews and procurement checklists, and it will save years of pain later.

## Step four: prioritise by data lifetime

Not everything needs to move first. Prioritise systems that protect long-lived sensitive data, systems that are hard to update (embedded devices, hardware roots of trust) and systems facing the public internet. A ten-year migration is manageable if the riskiest twenty per cent is planned early.

## Keep it proportionate

This is not a reason for panic, and it is not a reason to rip out working systems tomorrow. It is a reason to add cryptography to your asset register, ask suppliers some pointed questions and make crypto agility a design standard. Those three moves, started this year, put you comfortably on track for the NCSC's 2028 milestone.

If you would like help scoping a cryptographic inventory as part of a wider [Technology Health Assessment](/contact), we would be glad to talk.

## Frequently asked questions

### What is the NCSC deadline for post-quantum cryptography?

The NCSC asks organisations to complete discovery and an initial migration plan by 2028, finish highest-priority migrations by 2031 and complete migration of all systems by 2035.

### What does "harvest now, decrypt later" mean?

It describes attackers collecting encrypted data today so they can decrypt it in future once quantum computers capable of breaking current public-key cryptography exist.

### What is crypto agility?

Crypto agility is the ability to change cryptographic algorithms through configuration or a contained update, without rewriting the system that uses them.

## Sources

1. [Timelines for migration to post-quantum cryptography — National Cyber Security Centre](https://ncsc.gov.uk/guidance/pqc-migration-timelines)
