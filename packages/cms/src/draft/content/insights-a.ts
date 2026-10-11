/**
 * Placeholder insights, part one (owner directive of 11 October 2026, ADR-025 status note).
 *
 * Written from the Stage 13 narrative pillars and the Stage 3 and Stage 5 service and delivery
 * method, attributed to invented placeholder personas. They describe how Vitalos reasons about a
 * problem; they claim no client experience, no results and no statistics.
 */
import { h2, h3, ol, p, pLink, richText, ul } from "../build";
import type { InsightDraftBody } from "./insight-types";

export const aiPilotsStall: InsightDraftBody = {
  slug: "why-ai-pilots-stall-before-production",
  title: "Why AI pilots stall before production",
  summary:
    "A pilot proves that something can work once. Production asks whether it keeps working, safely, for the people who rely on it. The gap between the two is mostly engineering and operating work.",
  seoTitle: "Why AI pilots stall before production",
  seoDescription:
    "A prototype answers whether an AI idea can work. Production asks different questions. A placeholder article on closing that gap.",
  format: "insight-article",
  topics: ["ai-agents", "digital-transformation"],
  author: "jordan-ellis",
  publishedAt: "2026-10-01",
  related: ["evaluate-ai-before-it-goes-live", "data-foundations-before-ai"],
  sources: [
    [13, "4. Narrative pillars"],
    [13, "23. AI reputation system"],
    [3, "11. Signature AI Client Journey"],
    [3, "11.2 AI engagement principles"],
  ],
  body: richText(
    "insight-ai-pilots-stall",
    p(
      "Most organisations that explore AI can produce a convincing demonstration. A model answers a question about their own documents, or drafts a response, or sorts a queue, and the room is impressed. The hard part comes afterwards. A demonstration shows that something can work once, with a careful operator, on well-chosen examples. A production system has to work every day, for people who did not choose the examples, while the surrounding systems, data and expectations keep changing.",
    ),
    p(
      "This article sets out where pilots tend to stall and what changes when AI is treated as an engineering and operating problem rather than an experiment. It is a way of reasoning, not a report of results.",
    ),
    h2("A prototype and a production system answer different questions"),
    p(
      "A prototype sprint exists to test a hypothesis quickly: is there a use case worth pursuing, and is it technically plausible with the data and workflow we actually have? That is a valuable question, and a good sprint answers it honestly, including by showing that an idea is not worth pursuing. The mistake is to treat the answer as a readiness certificate. Prototype evidence does not automatically equal production readiness.",
    ),
    p(
      "Production asks a different set of questions. Who is accountable when the system is wrong? What happens when the data feed is late or malformed? How is quality measured after launch, and who looks at the measurement? What does it cost to run at the volume the business actually has? Which part of the work still needs a person, and how does that person step in?",
    ),
    h2("Five places a pilot commonly stalls"),
    h3("1. The use case was never tied to an outcome"),
    p(
      "A pilot chosen because the technology was interesting has no natural owner in the business. When the sprint ends there is nobody whose targets improve if it goes live, so nobody pays for the next stage. Every use case needs a business or user outcome that someone cares about, stated before the prototype is built.",
    ),
    h3("2. The data was good enough for a demonstration"),
    p(
      "Demonstration data is usually curated. Production data is whatever the organisation really holds, with its gaps, duplicates and inconsistent definitions. A pilot that quietly relied on tidy inputs will meet an entirely different system on its first live day. Data readiness, ownership and quality have to be examined explicitly, not assumed.",
    ),
    h3("3. Nobody defined what good looks like"),
    p(
      "If the success criteria were a feeling in a meeting, there is nothing to decide against when the pilot ends. Evaluation criteria should exist before the production launch, and ideally before the prototype. They do not need to be elaborate. They need to be written down, agreed and testable against real examples.",
    ),
    h3("4. Integration and security arrive last"),
    p(
      "A pilot often sits beside the real systems rather than inside them. Connecting it to identity, permissions, audit trails, existing workflows and the systems of record is ordinary engineering, but it is substantial, and it is frequently the largest part of the work. Leaving it until the end converts a plan into a surprise.",
    ),
    h3("5. There was no plan to operate it"),
    p(
      "Live AI capabilities need monitoring, review of outputs, a route for corrections, cost tracking and a way to improve them over time. If the pilot budget ended at the demonstration, nobody owns any of this, and the system either degrades quietly or is switched off.",
    ),
    h2("What changes when AI is treated as an engineering problem"),
    p(
      "The most useful shift is to make the journey explicit. At Vitalos we describe a recognisable sequence: an opportunity assessment, a prototype sprint, production implementation, scale and integration, and then managed operation. Each stage ends with a decision gate that asks a plain question. Is there a use case worth testing? Did the evidence justify production investment? Is the system ready for controlled live use? Where would wider adoption create value? Is it delivering continuing value, at acceptable quality and risk?",
    ),
    p("A few principles keep that sequence honest."),
    ul(
      "No AI for AI's sake: every use case needs an outcome that matters to a named group of people.",
      "Prefer bounded, measurable workflows before attempting broad autonomous systems.",
      "Make data readiness, security, privacy and human oversight explicit from the start.",
      "Define evaluation criteria before launch, and keep measuring after it.",
      "Understand operating cost, reliability and vendor dependence, and stay pragmatic about which model or provider is used.",
    ),
    h2("A short checklist before you approve the next stage"),
    p("Before moving from a pilot to a production build, it is worth being able to answer these."),
    ol(
      "Which outcome improves, for whom, and who is accountable for it?",
      "What data will the live system use, who owns it, and how was its quality examined?",
      "How will quality be measured on real examples, and what result would stop the rollout?",
      "Where does a person review, approve or override the system, and how is that recorded?",
      "What does it cost to run at realistic volume, and what happens when that cost or latency moves?",
      "Who monitors it after launch, and what is the route for a correction?",
    ),
    p(
      "If several of these have no answer, the pilot may still have been worthwhile. It has found out what the production plan must contain. That is a better position than discovering the same list after a launch.",
    ),
    h2("What this means for leaders"),
    p(
      "Executives do not need to judge model architectures. They do need to ask for the decision at each gate to be made on evidence, and to insist that the work between the demonstration and the live system is scoped and funded rather than assumed. A pilot that stalls is not always a failure. Sometimes it is the cheapest possible way to learn that a use case is not worth building. The failure is a pilot that stalls without anyone being able to say why.",
    ),
    pLink(
      "If you are weighing where to start, the ",
      "AI Opportunity Assessment",
      "/offers/ai-opportunity-assessment",
      " is designed to rank use cases by value, feasibility, data readiness and risk before anything is built.",
    ),
  ),
};

export const evaluateBeforeLive: InsightDraftBody = {
  slug: "evaluate-ai-before-it-goes-live",
  title: "Evaluate AI before it goes live, and keep evaluating",
  summary:
    "Evaluation is how an organisation knows whether an AI capability is good enough to release and whether it stays that way. It needs to be designed before launch, not added when something goes wrong.",
  seoTitle: "Evaluate AI before it goes live, and keep doing so",
  seoDescription:
    "Why evaluation criteria belong before launch, what to measure, and how to keep measuring a live AI capability. A placeholder article.",
  format: "engineering-note",
  topics: ["ai-agents", "software-platforms"],
  author: "jordan-ellis",
  publishedAt: "2026-10-03",
  related: ["why-ai-pilots-stall-before-production", "operate-what-you-build"],
  sources: [
    [13, "23. AI reputation system"],
    [13, "24. Engineering reputation system"],
    [5, "13. AI & Data delivery standard"],
    [5, "13.1 AI lifecycle"],
    [3, "11.2 AI engagement principles"],
  ],
  body: richText(
    "insight-evaluate-ai",
    p(
      "Ask a team how they know their AI feature is working and the answer is often an anecdote. Someone tried it on a few cases, it looked right, and the launch went ahead. That is understandable for a prototype. It is not a basis for something that customers or staff will depend on. Evaluation is the discipline that replaces the anecdote with evidence, and it is one of the clearest differences between an AI demonstration and an AI capability.",
    ),
    p(
      "This note describes how we think about evaluation as an engineering activity: what it is for, what to build before launch, and what to keep doing afterwards. It is a method, not a claim about any particular system.",
    ),
    h2("What evaluation is for"),
    p(
      "Evaluation answers three questions at different times. Before the build, it asks whether the idea is feasible and what quality bar would make it worthwhile. Before launch, it asks whether this specific implementation clears that bar on realistic examples. After launch, it asks whether quality, cost and risk are still acceptable as inputs, users and models change.",
    ),
    p(
      "Because the questions recur, evaluation is not a gate passed once. It is a capability that the system carries with it, much as a service carries monitoring.",
    ),
    h2("Define the criteria before you build"),
    p(
      "The most valuable evaluation work happens before any model is chosen. Writing down what a good answer looks like forces the team to agree on the task. Two people who both say they want a helpful assistant often mean different things: one wants speed, another wants cautious accuracy, a third wants a consistent tone.",
    ),
    p(
      "Useful criteria are specific to the workflow. They typically cover correctness against a source of truth, completeness, appropriate refusal when the system should not answer, handling of sensitive or out-of-scope requests, and the format the downstream process needs. They also record what is explicitly acceptable to get wrong and what is not.",
    ),
    h2("Build an evaluation set from real work"),
    p(
      "A small, carefully chosen set of real examples, with agreed expected outcomes, is worth more than a large set invented for convenience. It should include ordinary cases, awkward ones, and cases designed to provoke a failure. It should be owned by someone who understands the business process, not only by the engineers.",
    ),
    ul(
      "Take examples from the real workflow, with sensitive content handled according to the agreed data rules.",
      "Include the cases people complain about, not only the ones that go smoothly.",
      "Version the set, so a change in results can be traced to a change in the system or in the examples.",
      "Keep a held-back portion that is not used when tuning, so results are not flattered by familiarity.",
    ),
    h2("Measure more than answer quality"),
    p(
      "A system can give good answers and still be unfit for production. Evaluation should cover the properties that decide whether the capability can be run.",
    ),
    ul(
      "Quality: whether outputs meet the criteria, measured on the evaluation set.",
      "Safety and oversight: whether risky cases are escalated to a person, and whether that route works.",
      "Latency: whether responses arrive quickly enough for the workflow.",
      "Cost: what each task costs to run at realistic volume, and how that changes with usage.",
      "Reliability: what happens when a dependency is slow, unavailable or returns something unexpected.",
    ),
    h2("Use people and automated checks together"),
    p(
      "Automated checks are repeatable and cheap, which makes them suitable for every change. They are weaker on judgement, tone and subtle error. Human review is slower and costs more, but it is how an organisation learns what its own standard really is. A sensible arrangement uses automated checks on every change, with sampled human review to calibrate them and to look at the cases the checks cannot judge.",
    ),
    p(
      "If a model is used to grade another model's output, the grading should itself be checked against human judgement on a sample. Otherwise the system is marking its own homework.",
    ),
    h2("Keep evaluating after launch"),
    p(
      "Live use changes the picture. Users ask things nobody anticipated. The underlying data drifts. A provider updates a model. A new integration changes the inputs. Evaluation after launch is how those changes are caught before they become complaints.",
    ),
    ol(
      "Monitor a small set of agreed quality, cost and latency measures continuously.",
      "Sample real interactions for review on a regular rhythm, with privacy controls applied.",
      "Feed confirmed failures back into the evaluation set, so each one is caught next time.",
      "Re-run the full set whenever the model, prompt, tools or data change.",
      "Review the measures with the business owner, and revise the criteria when the task changes.",
    ),
    h2("Human oversight is part of the design"),
    p(
      "Where an AI capability can affect a customer, a decision or a record, the design should say where a person reviews, approves or overrides it. Oversight that exists only as a sentence in a policy does not count. It needs a working route, clear ownership and a record, and it should be exercised as part of evaluation, not discovered later.",
    ),
    h2("Who owns the evaluation"),
    p(
      "Evaluation tends to fall between teams. Engineers build the system, the business owns the process it supports, and risk functions care about the consequences of failure. If nobody owns the evaluation set and the quality measures, they decay. A named owner on the business side, supported by engineering, keeps the criteria tied to what the work actually needs and makes the results something leaders can use in a decision.",
    ),
    h2("A note on claims"),
    p(
      "Be careful how results are described. A figure from an evaluation set measures that set, on that date, for that version of the system. It is not a promise about live performance, and it should not be repeated as one. Describing what was measured, and how, is more useful to a reader than a single headline number.",
    ),
    p(
      "If you take one thing from this note, make it the order of work. Decide what good looks like, build the means to measure it, and only then judge whether the system is ready. Teams that reverse that order tend to find that their evaluation quietly adopts whatever the system already does.",
    ),
  ),
};

export const strategyToProduction: InsightDraftBody = {
  slug: "from-strategy-to-production",
  title: "From strategy to production: why advice alone is not enough",
  summary:
    "A recommendation only creates value once it is carried into live systems and working practice. This briefing explains why Vitalos keeps advice, engineering and operation in one accountable team.",
  seoTitle: "From strategy to production: why advice is not enough",
  seoDescription:
    "Why a recommendation must be carried into live systems to create value, and how one accountable team can do that. A placeholder briefing.",
  format: "executive-briefing",
  topics: ["digital-transformation", "software-platforms"],
  author: "alex-morgan",
  publishedAt: "2026-10-05",
  related: ["data-foundations-before-ai", "operate-what-you-build"],
  sources: [
    [13, "2. Market-memory strategy"],
    [13, "5. Founder brand architecture"],
    [5, "3. Vitalos Delivery Lifecycle"],
    [5, "9. Governance & accountability"],
    [3, "3. Client Entry and Discovery Model"],
  ],
  body: richText(
    "insight-strategy-to-production",
    p(
      "Many organisations have a stack of good recommendations. There are strategy documents, assessments and roadmaps, each sensible and each commissioned in good faith. What they often lack is a route from the recommendation to a working change in how the organisation operates. The gap is rarely about intelligence. It is about who carries the idea through design, engineering, release and operation, and who is accountable if it does not arrive.",
    ),
    p(
      "This briefing explains why we keep those stages together, what that changes for a leadership team, and the questions worth asking of any adviser, including us.",
    ),
    h2("The handover problem"),
    p(
      "When strategy, build and operation sit in different organisations, every boundary is a handover. Context is lost, assumptions are restated as facts, and the team that inherits a decision was not in the room when it was made. Each party can behave reasonably and the combined result can still be poor.",
    ),
    p(
      "A recommendation written without knowledge of the existing systems may be impractical. A system built to a specification written without knowledge of the operating reality may be hard to run. A service taken on without involvement in the design may be hard to support. None of this requires bad faith. It follows from the structure.",
    ),
    h2("What it means to carry an idea into production"),
    p(
      "We describe delivery as a lifecycle with nine stages: qualify, discover, define, design, engineer, validate, release, operate and improve. Not every engagement uses every stage with the same weight. A short assessment might concentrate on qualification, discovery, definition and validation. A mature system takeover might emphasise discovery, validation, operation and improvement. A major platform build uses the whole lifecycle.",
    ),
    p(
      "The point of naming the stages is that responsibilities do not disappear when the work is iterative. Agile delivery does not remove the need for architecture, validation, release control or operational readiness. It changes when they happen, not whether they matter.",
    ),
    h2("Why accountability matters more than breadth"),
    p(
      "Every engagement has one accountable lead, responsible for the outcome, the delivery, the risk, communication with the client and the economics of the work. That person draws on specialists from the practices a problem needs, but the client works with one integrated team, not a relay of separate ones.",
    ),
    p(
      "For a leadership team, this is the most practical benefit. When something goes wrong, or an assumption proves false, there is one person to speak to who can make a decision and who owns the consequence. Senior accountability is not a slogan. It is a design choice about how an engagement is run.",
    ),
    h2("Starting where the problem is"),
    p(
      "Clients arrive in different places. Some come with a strategic question, such as where AI should be applied or how a legacy estate should evolve. Others come with a defined engineering need and want it built. We aim to meet both without forcing either through unnecessary process.",
    ),
    ul(
      "A consulting-led entry begins by understanding the business problem and the options, then moves into design and build.",
      "An engineering-led entry can start directly with the build, while discovery becomes mandatory where requirements are unclear, several systems or stakeholders are involved, risk is meaningful or the cost of being wrong is high.",
      "In both cases the discovery that is done is proportionate to the uncertainty, not a fixed ritual.",
    ),
    h2("Questions to ask any adviser"),
    p(
      "These questions are as relevant to us as to anyone else. They are intended to help a leadership team judge whether a recommendation is likely to survive contact with reality.",
    ),
    ol(
      "Who will carry this recommendation into the live environment, and are they involved now?",
      "What has to be true of our existing systems and data for this to work, and who has checked?",
      "What does done mean here, and who decides?",
      "Who is accountable for the outcome, and how do I reach them?",
      "What happens after release, and who operates and improves the result?",
      "What would make you advise us not to proceed?",
    ),
    h2("The last question matters most"),
    p(
      "A willingness to decline or reshape work is a sign of seriousness. Qualification exists to prevent a firm from accepting work that is commercially weak, technically impossible, badly sponsored or misaligned with what the client needs. An adviser who never says no may simply be selling.",
    ),
    p(
      "For us, that means being ready to say when a problem is not yet ready to be solved, when the sponsor or the data is missing, or when a cheaper and smaller step would serve better. It is less comfortable in the short term and more useful in the long term.",
    ),
    h2("What this looks like in practice"),
    p(
      "It is easy to describe integration in the abstract, so consider how it shapes ordinary decisions. Suppose a leadership team wants to modernise a customer-facing process that touches several systems and a good deal of manual work. A purely advisory approach would produce a target model and a roadmap, and stop. An integrated approach treats the roadmap as the first draft of a delivery plan.",
    ),
    ul(
      "The target model is tested against the real systems and data early, so impractical elements are removed before anyone depends on them.",
      "The first increments are chosen because they can be released safely and teach the team something, not only because they appear first on a diagram.",
      "Security, privacy, accessibility and operational readiness are designed in, not inspected in at the end.",
      "The people who will run the result are involved before release, so the handover is a continuation and not a surprise.",
      "After release, the same team reviews how the change is performing and proposes the next improvement.",
    ),
    p(
      "None of this removes the need for judgement or for honest disagreement. It does mean that disagreement happens early, in the open, between people who share responsibility for the result, which is cheaper than finding it in a post-launch review.",
    ),
    h2("The limits of the approach"),
    p(
      "Keeping stages together is not always the right answer. Some organisations already have a strong delivery team and need only an independent view. Some decisions are better made by someone with no stake in the build. A good adviser will say which of these applies, and will not insist on a larger engagement than the problem needs.",
    ),
    h2("What to do next"),
    pLink(
      "If you hold recommendations that have not yet become working change, one useful first step is a short, evidence-based look at what stands in the way. The ",
      "Digital Transformation Discovery",
      "/offers/digital-transformation-discovery",
      " offer is designed for exactly that kind of question.",
    ),
  ),
};
