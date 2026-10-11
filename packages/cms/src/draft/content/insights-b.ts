/**
 * Placeholder insights, part two (owner directive of 11 October 2026, ADR-025 status note).
 * Same rules as part one: reasoning drawn from the strategy documents, invented placeholder
 * authors, no client experience, no results, no statistics.
 */
import { h2, h3, ol, p, pLink, richText, ul } from "../build";
import type { InsightDraftBody } from "./insight-types";

export const modernisationChoice: InsightDraftBody = {
  slug: "repair-refactor-or-rebuild",
  title: "Repair, refactor or rebuild: choosing a modernisation path",
  summary:
    "Ageing software rarely needs a single heroic rewrite. This note sets out a risk and value way of choosing between repairing, progressively refactoring and replacing a system.",
  seoTitle: "Repair, refactor or rebuild: choosing a path",
  seoDescription:
    "A risk and value way to choose between repairing, refactoring and replacing an ageing system. A placeholder engineering note.",
  format: "engineering-note",
  topics: ["software-platforms", "cloud-reliability"],
  author: "sam-rivers",
  publishedAt: "2026-10-06",
  related: ["operate-what-you-build", "data-foundations-before-ai"],
  sources: [
    [13, "24. Engineering reputation system"],
    [13, "10. Flagship intellectual property"],
    [3, "5.1 Core capabilities"],
    [3, "5.2 Initial engineering offers"],
    [5, "5. Design & Engineer"],
  ],
  body: richText(
    "insight-repair-refactor-rebuild",
    p(
      "Almost every organisation with a few years of software has a system that nobody loves and everybody depends on. It is slow to change, expensive to run or poorly understood, and it supports processes the business cannot stop. The temptation is to ask for a rebuild. Sometimes that is right. Often it is the most expensive way to discover that the real constraints lay elsewhere.",
    ),
    p(
      "This note describes a way of making the decision on risk and value rather than frustration. It reflects how we reason about modernisation work, not any particular engagement.",
    ),
    h2("Three paths, not two"),
    p(
      "The debate is usually framed as keep or replace. In practice there are three paths, and the middle one is the most underused.",
    ),
    ul(
      "Repair: stabilise what exists, fix the defects that cause the most harm, and add the monitoring and tests that make change safer. Low disruption, but it does not remove structural limits.",
      "Refactor progressively: reshape the system in steps, extracting or replacing parts while it stays in service. Higher effort than a repair and far lower risk than a single cut-over.",
      "Rebuild or replace: build or buy a new system and migrate to it. Highest potential reward, and the highest exposure to schedule, data migration and behavioural surprises.",
    ),
    h2("Start by learning what the system really does"),
    p(
      "Legacy systems often carry behaviour that nobody documented because it grew in response to real events. A rebuild specified from the documentation alone tends to omit some of it, and the omissions surface after go-live as business problems. Before choosing a path it is worth establishing a technical baseline: what the system does, what depends on it, how it is deployed, where its data lives and which parts change most often.",
    ),
    p(
      "That baseline does not have to be exhaustive. It has to be good enough to make the decision and to show where the risk is concentrated.",
    ),
    h2("Judge each part on risk and value"),
    p(
      "A system is rarely uniformly good or bad. A useful exercise is to divide it into parts and place each on two axes. One is the value the part delivers to the business. The other is the risk it carries, which combines how fragile it is, how hard it is to change and how costly a failure would be.",
    ),
    ol(
      "High value, low risk: leave it alone, and protect it with tests and monitoring.",
      "High value, high risk: the priority for careful work, usually by progressive refactoring behind a stable interface.",
      "Low value, low risk: tolerate it, or retire it when convenient.",
      "Low value, high risk: a candidate for replacement or removal, ideally before it causes harm.",
    ),
    p(
      "This often reveals that only part of the estate needs deep change, which makes a whole-system rebuild harder to justify.",
    ),
    h2("Questions that usually settle the choice"),
    h3("How well is the behaviour understood?"),
    p(
      "Poorly understood behaviour favours refactoring, where each step can be compared against the live system. It argues against a rebuild, which must reproduce behaviour nobody has written down.",
    ),
    h3("How constrained is the architecture?"),
    p(
      "If the limits are in the structure, such as tightly coupled components or a data model that cannot represent the business, repairs will only delay the problem. If the limits are in operations, such as poor deployment or no monitoring, they can often be addressed without a rewrite.",
    ),
    h3("Can the business tolerate a cut-over?"),
    p(
      "A single switch from old to new concentrates risk in one weekend. If the process cannot pause, a gradual migration is usually safer, even though it takes longer and means running two things for a while.",
    ),
    h3("What is the state of the team and its knowledge?"),
    p(
      "A rebuild needs people who understand both the old system and the new design. If that knowledge has left the organisation, discovery work has to come first, whichever path is chosen.",
    ),
    h2("Make the work safe to change"),
    p(
      "Whichever path is chosen, the first investment is usually the same: make change safer. That means version control for everything, automated builds and checks, tests around the most important behaviour, an environment where changes can be tried and a way to roll back. Without these, every modernisation path carries more risk than it needs to.",
    ),
    p(
      "Material decisions should be recorded as short decision records, stating the context, the options considered and the reason for the choice. They cost little and are very useful when the team changes or the decision is later questioned.",
    ),
    h2("Plan for operation, not just delivery"),
    p(
      "A modernised system still has to be run. Observability, alerting, runbooks, backup and recovery, and clear ownership should be part of the scope and not an afterthought. A system that is faster to change but harder to operate has traded one problem for another.",
    ),
    h2("Sequence the work so value arrives early"),
    p(
      "A modernisation programme that delivers nothing for a year is hard to defend and easy to cancel. Where possible, order the work so that each step leaves the system in a better and working state. Typical early steps include putting tests around the most fragile behaviour, automating the build and deployment, adding monitoring, and extracting one well-understood part behind a clear interface. Each makes the next step cheaper, and each produces something the business can see.",
    ),
    p(
      "It also helps to agree in advance what would cause the plan to change. If the baseline work shows that the system is in worse shape than expected, or that a vendor product now meets the need, the team should be free to say so and revise the path without that being treated as a failure.",
    ),
    h2("A note on naming and certainty"),
    p(
      "It is tempting to turn a decision method into a branded framework. We would rather a method earned a name after it had proved useful and repeatable. For now, treat the approach above as a structured way of asking questions, not a formula that produces an answer. The judgement still has to be made by people who understand the system and the business.",
    ),
    pLink(
      "If you are weighing these options for a particular system, the ",
      "Application Modernisation",
      "/offers/application-modernisation",
      " offer begins with an evidence-based view of the current state before any commitment to a path.",
    ),
  ),
};

export const operateWhatYouBuild: InsightDraftBody = {
  slug: "operate-what-you-build",
  title: "Operate what you build: reliability and handover as design inputs",
  summary:
    "A system is only as dependable as the way it is operated. Treating monitoring, ownership and handover as part of the design makes delivery safer and ongoing improvement possible.",
  seoTitle: "Operate what you build: reliability and handover",
  seoDescription:
    "Why monitoring, ownership and handover belong in the design of a system, and what a safe transition to operation involves. A placeholder article.",
  format: "insight-article",
  topics: ["cloud-reliability", "software-platforms"],
  author: "sam-rivers",
  publishedAt: "2026-10-08",
  related: ["repair-refactor-or-rebuild", "evaluate-ai-before-it-goes-live"],
  sources: [
    [13, "24. Engineering reputation system"],
    [5, "7. Operate & Improve"],
    [5, "17. Managed Services operating model"],
    [5, "12. Engineering operating standard"],
    [3, "8. Vitalos Managed Services"],
  ],
  body: richText(
    "insight-operate-what-you-build",
    p(
      "A project is usually judged on whether it was delivered. A system is judged, for years afterwards, on whether it keeps working. The two are connected more tightly than the way organisations budget for them suggests. Many operational problems are decided during design, when nobody was thinking about the person who would be woken at night or the team who would inherit the code.",
    ),
    p(
      "This article argues for treating operation as a design input from the start, and describes what a careful transition from build to run involves.",
    ),
    h2("What operation really involves"),
    p(
      "Running a live system is more than keeping servers up. It includes watching the health of the service, responding to incidents, applying updates and security fixes, managing releases and deployments, tracking cost, keeping data accurate and continuing to improve the product as the business changes. Each of these is cheaper and safer when the system was built to support it.",
    ),
    h2("Design choices that decide how a system behaves in production"),
    ul(
      "Observability: logs, measures and traces on the paths that matter, so a problem can be seen and located without guesswork.",
      "Failure behaviour: how the system behaves when a dependency is slow, unavailable or wrong, including retries that do not cause duplicates.",
      "Release safety: small, reversible changes with automated checks, and a rollback that has been tried.",
      "Recoverability: backups that are restored in practice, and a clear target for how quickly service must return.",
      "Environment discipline: separate environments that resemble each other closely enough for testing to mean something.",
      "Documentation that a new engineer can follow, kept as part of the work and not written once and forgotten.",
    ),
    h2("Ownership has to be explicit"),
    p(
      "A surprising number of incidents are prolonged by a single question: whose is this? Every material component, integration and data flow should have a named owner, and the escalation route for a serious incident should be known in advance. When a system crosses organisational boundaries, which is common, the boundary needs an agreement, not an assumption.",
    ),
    h2("A transition, not a throw over the wall"),
    p(
      "Moving a system into operation is a stage of delivery with its own work and its own decision. It is not the end of the project. A careful transition normally includes an assessment of the system as it is, a period of working alongside the team who built or previously ran it, agreed service expectations and a clear point at which responsibility changes hands.",
    ),
    h3("Taking over a system someone else built"),
    p(
      "Operating a system built elsewhere deserves its own caution. Before committing to run it, it is sensible to assess the application and its repository, the deployment, the data, the security posture, the documentation, the dependencies and the incident history. The honest outcomes of that assessment include accepting the system, accepting it with conditions, recommending stabilisation first, or declining. A commitment made without this step is a risk taken on someone else's information.",
    ),
    h2("Support tiers should match the need"),
    p(
      "Not every system needs round-the-clock cover, and promising it where it is not needed adds cost and fragility. The right level depends on how critical the system is, how quickly an outage hurts and what the business can sustain. Service commitments should be set out plainly, with what is and is not included, rather than implied.",
    ),
    h2("Operation is also where improvement happens"),
    p(
      "A live system produces evidence that no design workshop can. It shows which features are used, where users struggle, which components fail and which changes carry risk. A regular improvement review turns that evidence into a prioritised list of work. Without one, a live system drifts, and the cost of change slowly rises until the organisation again asks for a rebuild.",
    ),
    ol(
      "Review incidents and near misses for the underlying cause, not only the immediate fix.",
      "Track the measures that matter for the service, and agree what is acceptable.",
      "Keep a visible, prioritised improvement backlog alongside new feature requests.",
      "Revisit cost, performance and security on a set rhythm.",
      "Update documentation and runbooks whenever the system or the way it is run changes.",
    ),
    h2("Incidents are information"),
    p(
      "How an organisation behaves during an incident says a great deal about how it was designed. A calm, practised response depends on a few unglamorous things: alerts that point at causes and not only symptoms, an agreed way to declare and communicate an incident, runbooks for the failures that are already known, and a habit of reviewing what happened without searching for someone to blame.",
    ),
    p(
      "The review matters more than the response. A short written account of what happened, what was learned and what will change, kept somewhere the whole team can find it, turns each incident into an improvement. Over time it also builds the shared understanding that new team members need.",
    ),
    h2("Cost and capacity belong in the picture"),
    p(
      "Operation has a cost that grows with usage, with the number of components and with the amount of data kept. Designs that ignore this tend to be pleasant at small scale and expensive at real scale. Track what the system costs to run alongside how well it performs, and review both on a regular rhythm so that surprises are small. Capacity planning does not have to be sophisticated. It has to be done, and the assumptions behind it have to be written down.",
    ),
    h2("Questions to ask before you build"),
    p("A few questions asked early can prevent a lot of later difficulty."),
    ul(
      "Who will run this when it is live, and have they seen the design?",
      "How will we know it is unhealthy before a customer tells us?",
      "What is our plan if the release goes wrong?",
      "What does recovery involve, and when did we last practise it?",
      "Who owns the improvement backlog once the project team has moved on?",
    ),
    p(
      "None of these is exotic, and none requires a particular technology. They require a willingness to treat the day after launch as part of the work.",
    ),
    pLink(
      "For systems already in service, the ",
      "Managed Engineering & Application Care",
      "/offers/managed-engineering-application-care",
      " offer describes how ongoing maintenance, incident support and planned improvement can be arranged.",
    ),
  ),
};

export const dataFoundations: InsightDraftBody = {
  slug: "data-foundations-before-ai",
  title: "Data foundations: the unglamorous decision behind every AI plan",
  summary:
    "Plans for analytics and AI usually depend on data that is scattered, inconsistent or poorly owned. For leaders, the useful question is which data foundations are worth building first, and why.",
  seoTitle: "Data foundations: the decision behind every AI plan",
  seoDescription:
    "Why trustworthy data foundations come before analytics and AI ambitions, and how leaders can decide what to fix first. A placeholder briefing.",
  format: "insight-article",
  topics: ["data-analytics", "ai-agents"],
  author: "alex-morgan",
  publishedAt: "2026-10-09",
  related: ["why-ai-pilots-stall-before-production", "repair-refactor-or-rebuild"],
  sources: [
    [13, "4. Narrative pillars"],
    [13, "23. AI reputation system"],
    [3, "6.2 Initial AI & Data offers"],
    [5, "13.2 Data engineering controls"],
  ],
  body: richText(
    "insight-data-foundations",
    p(
      "Almost every conversation about analytics or AI eventually arrives at the same place. The ambition is clear, the tools are available, and the obstacle is the data. It sits in several systems, defined differently in each, maintained by different people and trusted by almost nobody. Leaders sometimes treat this as a technical detail to be dealt with later. It is better understood as the decision that determines how far the rest of the plan can go.",
    ),
    p(
      "This briefing is for executives and operations leaders. It describes what a data foundation is, why it is hard to prioritise and how to decide what to do first.",
    ),
    h2("What a data foundation is"),
    p(
      "A data foundation is not a product to buy. It is the combination of connected sources, agreed definitions, clear ownership, quality controls and access rules that lets people and systems rely on the data they use. It is mostly ordinary, careful work: connecting, cleaning, modelling and governing.",
    ),
    ul(
      "Connected: data from the systems that matter can be brought together reliably.",
      "Defined: a customer, an order or an incident means the same thing wherever it appears.",
      "Owned: a named person is accountable for each important dataset.",
      "Checked: quality is measured and problems are visible.",
      "Governed: access, retention and privacy follow clear rules.",
    ),
    h2("Why it is easy to postpone"),
    p(
      "Data work has an unfortunate shape. Its costs are visible and immediate, while its benefits are spread across many later initiatives and are hard to attribute. A new dashboard or an AI feature has a sponsor and a launch. A well-governed customer dataset has neither, though a dozen future projects will quietly depend on it.",
    ),
    p(
      "The result is a pattern in which each project builds its own temporary data preparation, and the organisation accumulates several inconsistent versions of the truth. The next project then starts from a worse position.",
    ),
    h2("How data readiness affects AI"),
    p(
      "AI makes these problems more visible rather than less. A model working from inconsistent or outdated data will produce confident, inconsistent or outdated answers. Retrieval from poorly organised documents returns poorly organised results. An automation that acts on inaccurate records acts inaccurately, and faster.",
    ),
    p(
      "For this reason an AI opportunity assessment should look at data readiness alongside value, feasibility and risk. A use case that scores well on value but depends on data that does not exist in usable form is not ready to build. It is a data project first, and it is better to find that out in an assessment than in a prototype.",
    ),
    h2("Deciding what to fix first"),
    p(
      "It is not necessary, and usually not wise, to try to fix everything. A practical sequence is to choose the decisions or processes that matter most and work backwards to the data they need.",
    ),
    ol(
      "List the handful of decisions or workflows where better data would change what the business does.",
      "For each, identify the data it needs, where that data lives and who owns it.",
      "Assess quality and accessibility honestly, with examples rather than assurances.",
      "Choose the smallest set of foundations that unlock the highest-value use cases.",
      "Build them in a way that later projects can reuse, rather than for one dashboard.",
      "Put ownership and quality measures in place so the foundation does not decay.",
    ),
    h2("Questions leaders can ask"),
    ul(
      "If I ask three people for the same figure, will I get the same answer, and if not, why?",
      "Which dataset would hurt most if it were wrong, and who is accountable for it?",
      "How long does it take to answer a new question with our data, and where is the time going?",
      "Which planned initiatives depend on data we do not yet have in usable form?",
      "Could we explain to a customer or regulator how a particular figure was produced?",
    ),
    h2("A worked way of thinking about priorities"),
    p(
      "Consider an operations leader who wants earlier warning of delivery problems, and a customer team that wants a single view of each account. Both ambitions depend on data, and they may depend on much of the same data. A sensible plan looks for the overlap first. If a shared, well-defined account and order dataset would serve both, build that before building either dashboard. If the two need genuinely different data, sequence them by value and by how ready the data is.",
    ),
    p(
      "This way of thinking replaces the question of which tool to buy with the question of which decisions the data must support. It also makes trade-offs visible to the leadership team. Spending effort on a foundation delays a visible deliverable, and that is a legitimate choice only if the organisation can see what it is buying.",
    ),
    h2("Signs that foundations need attention"),
    ul(
      "Teams keep their own spreadsheets because they do not trust the shared reports.",
      "A request for a new report starts a long search for where the data lives.",
      "Two reports that should agree do not, and nobody is sure which is right.",
      "Every new project begins by extracting and cleaning the same data again.",
      "Nobody can say who is allowed to change a definition, or what would break if they did.",
    ),
    p(
      "Any one of these is common. Several together suggest that foundation work would pay back across many later initiatives, even though no single initiative would fund it.",
    ),
    h2("Governance is part of the foundation"),
    p(
      "Data quality and data protection are linked. Knowing where personal and sensitive data lives, who may use it and for what purpose is part of building something dependable. Organisations that treat governance as a later compliance exercise often find that it constrains what they can do with their data. Treated as part of the foundation, it makes AI and analytics projects easier to approve.",
    ),
    h2("Avoid the platform trap"),
    p(
      "Buying a platform is easier to approve than agreeing definitions and ownership, and it is also easier to disappoint. A tool does not decide what a customer is, and it does not make anyone accountable. Choose technology after the foundations are understood, and keep the choice pragmatic and open to change.",
    ),
    pLink(
      "If you want to know whether your data is ready for the ambitions you have, the ",
      "Data & BI Modernisation",
      "/offers/data-bi-modernisation",
      " offer is one way to find out, as is an AI Opportunity Assessment that includes data readiness.",
    ),
  ),
};
