---
title: "Securing AI agents that can act: prompt injection, tool access and MCP"
slug: ai-agent-security-prompt-injection-mcp
format: Engineering note
authors: [Vitalos]
publish_date: 2026-05-14
topics: [AI and agents, Software and platforms]
sectors: [Growth & Technology, Health & Care, "Retail, Commerce & Consumer", "Operations, Industry & Logistics"]
practice: AI & Data
featured: false
excerpt: "A chatbot that gets tricked says something silly. An agent that gets tricked does something. A practical security model for AI agents, MCP servers and the tools they can reach."
seo_title: "AI agent security: prompt injection and MCP"
seo_description: "AI agent security in practice: prompt injection, MCP tool poisoning, rug pulls and token theft, with controls for least privilege, isolation and audit."
focus_keyword: AI agent security
secondary_keywords: [prompt injection, MCP security, Model Context Protocol, tool poisoning, agentic AI security]
cta_label: Talk to Vitalos
cta_href: /contact
reading_minutes: 5
---

When a chatbot gets tricked, you get an embarrassing screenshot. When an agent gets tricked, you get an action. A refund issued. A file sent. A record deleted. A message posted to a customer in your company's name.

That is the shift security teams need to get their heads around. AI agents are not just generating text any more. Through protocols such as the **Model Context Protocol (MCP)**, they connect to email, databases, ticketing systems, code repositories and payment tools. Every one of those connections is a door, and the agent is deciding which ones to open based on text it reads, some of which an attacker may have written. That, in one sentence, is the problem of AI agent security.

## The threats in plain English

The Cloud Security Alliance's draft guidance on agentic MCP security, published in April, sets out the main risks clearly ([Cloud Security Alliance](https://labs.cloudsecurityalliance.org/agentic/agentic-mcp-security-best-practices/)). In plain terms:

**Prompt injection.** An agent reads a web page, email or document that contains hidden instructions, and follows them. The user sees normal behaviour while the agent quietly does something else.

**Tool poisoning.** A malicious MCP server hides instructions inside its tool descriptions. The model reads those descriptions to decide how to use the tool, so the attack sits exactly where the agent is paying most attention.

**Rug pulls.** A server is reviewed and approved, then its tool definitions or behaviour change later while it keeps the trust it earned.

**Token and session theft.** OAuth tokens and session credentials stolen through malicious authorisation endpoints, plaintext connections or hijacked subdomains.

**Supply chain attacks.** Typosquatted or compromised npm and PyPI packages that carry malicious MCP servers, the same playbook seen in the [Axios npm compromise](/insights/software-supply-chain-security-npm-attacks) in March.

The guidance also highlights CVE-2025-6514, a critical flaw (CVSS 9.6) in the widely used `mcp-remote` proxy that let a malicious server run commands on a client machine.

## The dangerous combination

A useful way to think about risk, popularised by the developer Simon Willison, is to look for three things together: access to private data, exposure to untrusted content, and the ability to communicate externally. An agent with all three can be tricked into reading something it should not and sending it somewhere it should not.

You will not always be able to remove all three. But every agent design review should ask which of them is present and whether the combination is truly necessary for the job.

## Controls that work

You do not need a new security discipline. You need familiar principles applied to a new kind of user: a fast, tireless and occasionally gullible one.

**Least privilege, per tool.** Give each agent the narrowest set of tools and scopes the task needs. Read-only by default. Write access only where essential, and never broad administrative tokens. If an agent only needs to read orders, it should not be able to issue refunds.

**Humans approve consequential actions.** Anything that moves money, deletes data, sends external messages or changes permissions should require explicit confirmation, at least until you have evidence the agent handles it reliably.

**Verify what tools say about themselves.** The CSA recommends hashing or signing tool definitions at registration, alerting on any change, screening descriptions for embedded instructions and requiring re-approval when something changes. That closes the door on rug pulls.

**Authenticate properly.** Use OAuth 2.1 with PKCE for remote servers, enforce modern TLS, keep access tokens short-lived and never store them in plain text.

**Isolate execution.** Run MCP servers in containers or micro-VMs with no filesystem or outbound network access by default. If something does go wrong, it should hit a wall.

**Control the supply chain.** Use a curated, private registry of approved MCP servers, pin versions and monitor them for vulnerabilities, just as you would any other dependency.

**Log everything the agent does.** Every tool call, with its parameters and result, into your security monitoring. Unusual volumes or parameter patterns are often the first sign of trouble.

## A gateway, not a free-for-all

A practical pattern is to route all agent tool access through an **MCP gateway**: a single control point that enforces approved servers, authentication, scopes, rate limits and logging. It turns dozens of individual integrations into one place you can govern, audit and switch off if needed.

## Test like an attacker

Before an agent touches production, try to break it. Feed it documents with hidden instructions. Give it a tool description that tries to redirect it. See whether it leaks data when asked cleverly. Make these attacks part of your standard [evaluation before go-live](/insights/how-to-evaluate-ai-systems-before-production), and rerun them every time the model, prompts or tools change.

Agents can do remarkable work. The organisations that benefit most will be the ones that treat them like any other powerful system: useful, monitored and kept on a short leash until they have earned more. If you are designing agents with real system access, our AI & Data team can help you [build the guardrails in from the start](/contact).

## Frequently asked questions

### What is prompt injection?

Prompt injection is an attack where hidden instructions in content an AI reads, such as a web page, document or email, cause it to ignore its intended instructions and do something else.

### What is MCP tool poisoning?

Tool poisoning is when a malicious MCP server hides instructions inside its tool descriptions so the AI model follows them while the user sees normal behaviour.

### How do you secure AI agents?

Apply least privilege per tool, require human approval for consequential actions, verify tool definitions, authenticate with short-lived tokens, isolate execution, control the supply chain of MCP servers and log every action.

## Sources

1. [Agentic MCP Security Best Practices Guide — Cloud Security Alliance, April 2026](https://labs.cloudsecurityalliance.org/agentic/agentic-mcp-security-best-practices/)
