---
title: "Three hours on npm: hardening your software supply chain after the Axios attack"
slug: software-supply-chain-security-npm-attacks
format: Engineering note
authors: [Vitalos]
publish_date: 2026-04-22
topics: [Software and platforms, Cloud and reliability]
sectors: [Growth & Technology, "Retail, Commerce & Consumer", Health & Care, "Operations, Industry & Logistics"]
practice: Engineering
featured: false
excerpt: "A backdoored release of one of the world's most popular JavaScript libraries was live for about three hours. Here are the controls that would have kept it out of your builds."
seo_title: "Software supply chain security after the npm attacks"
seo_description: "Software supply chain security after the Axios npm compromise: practical controls for npm, PyPI and CI pipelines that keep bad releases out."
focus_keyword: software supply chain security
secondary_keywords: [npm supply chain attack, Axios npm compromise, open source security, dependency management, CI/CD security]
cta_label: Talk to Vitalos
cta_href: /contact
reading_minutes: 5
---

At 00:21 UTC on 31 March, two new versions of Axios appeared on npm. Axios is one of the most widely used JavaScript libraries on the planet, with around 100 million weekly downloads. Versions 1.14.1 and 0.30.4 looked routine. They were not.

Each quietly added a hidden dependency, `plain-crypto-js`, whose install script fetched a remote access trojan built for macOS, Windows and Linux. npm pulled the versions at 03:20 UTC. That is about three hours, and in that window any machine or pipeline that ran an install could have pulled the malware. It was a sharp reminder of why software supply chain security is now a board-level topic ([Tech Insider](https://tech-insider.org/north-korea-axios-npm-supply-chain-attack-2026/)).

How it happened is the part every engineering leader should read twice. According to the reporting, the attackers spent around two weeks building trust with the lead maintainer, including through deepfake-enhanced video calls, then stole a long-lived npm access token and used it to publish. Google Threat Intelligence Group attributed the attack to UNC1069, a North Korean threat actor. Some organisations kept installing the bad versions from local caches even after the public takedown.

Axios was not alone. Red Hat's advisory RHSB-2026-001 notes that in March 2026, multiple widely used open source projects were hit by supply chain attacks, including LiteLLM, Trivy, KICS and Telnyx packages ([Red Hat](https://access.redhat.com/security/vulnerabilities/RHSB-2026-001)).

## Why this keeps working

Modern software is assembled, not written. A typical web application pulls in hundreds or thousands of transitive dependencies, each maintained by someone you have never met. Package managers will happily run code from any of them at install time. Continuous integration pipelines install fresh on every build, often with access to cloud credentials and publishing tokens.

From an attacker's point of view, compromising one popular maintainer is far more efficient than attacking a thousand companies one by one. And with AI-assisted social engineering, compromising a maintainer is getting easier.

## The controls that matter, in order of effort

The good news is that a handful of well-understood practices would have blocked or contained most of this year's incidents. Start at the top and work down.

**Lock and verify every dependency.** Commit lockfiles and install with `npm ci` (or the equivalent for your ecosystem) so builds use exactly the versions you reviewed, with integrity hashes checked. A floating version range is an open invitation.

**Add a cooling-off period for new releases.** Most malicious versions are detected within hours or days. Configure your tooling or private registry so that brand-new releases cannot be installed until they are a few days old, unless someone explicitly approves them. The Axios window was three hours. A 72-hour delay would have made it irrelevant.

**Turn off install scripts where you can.** Running arbitrary code on install is how both Axios and many earlier attacks executed. Disable lifecycle scripts by default (for example with `--ignore-scripts`) and allow-list the few packages that truly need them.

**Proxy through a private registry.** Pull dependencies through a registry you control. It gives you a single place to block known-bad versions, apply the cooling-off rule and, importantly, purge cached copies when an incident is announced. Remember those organisations still installing from caches after the takedown.

**Lock down your pipelines.** Build jobs should not hold long-lived credentials, and they should not have unrestricted outbound internet access. Restrict egress to the registries and services the build needs. If malware does land, it should find nothing worth stealing and nowhere to send it.

**Know what you ship.** Generate a software bill of materials (SBOM) for every build so that when the next advisory lands you can answer "are we affected?" in minutes rather than days.

## If you publish packages, too

If your organisation maintains open source or internal packages, the Axios story is a warning about tokens. Use short-lived, scoped publishing credentials, prefer trusted publishing from CI over personal tokens, enforce strong multi-factor authentication on maintainer accounts and require more than one person to approve a release of anything widely used. Treat unsolicited, unusually persistent approaches to maintainers with the suspicion they deserve.

## What to do this week

Check whether any of your builds or developer machines installed Axios 1.14.1 or 0.30.4, or any of the packages named in the Red Hat advisory, during the affected windows, and rotate any credentials those environments could reach. Then pick two controls from the list above that you do not have today and put them in place before the end of the month.

Supply chain security does not need a moonshot. It needs boring, consistent engineering discipline, applied before the next three-hour window opens. If you want a second pair of eyes on your pipelines, our engineering team runs focused [delivery and security reviews](/contact).

## Frequently asked questions

### What happened in the Axios npm attack?

On 31 March 2026, attackers used a stolen maintainer token to publish Axios versions 1.14.1 and 0.30.4 with a hidden malicious dependency. The versions were live for about three hours before npm removed them.

### How can I protect my project from npm supply chain attacks?

Commit lockfiles, install with integrity checks, delay adoption of brand-new releases, disable install scripts by default, proxy through a private registry and restrict CI credentials and network access.

### What is an SBOM?

A software bill of materials is a list of every component and dependency in a piece of software, used to check quickly whether you are affected by a newly disclosed vulnerability or compromise.

## Sources

1. [North Korea's Axios npm hijack: inside the 100M-download supply chain attack — Tech Insider](https://tech-insider.org/north-korea-axios-npm-supply-chain-attack-2026/)
2. [RHSB-2026-001: Multiple supply chain compromises of open source projects — Red Hat](https://access.redhat.com/security/vulnerabilities/RHSB-2026-001)
