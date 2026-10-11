/**
 * The five practices (Stage 3 §4-8; Stage 8 §10). Names are locked copy (`practiceDisplayName`);
 * everything else is drafted from the cited sections and is pending owner approval.
 */
import { practiceDisplayName } from "../../locked-copy";
import type { PracticeView } from "../../content/types";
import { cta, h2, p, richText, seo, ul } from "../build";
import { cite, drafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import type { IndustrySlug, PracticeSlug, SolutionSlug } from "../slugs";

export interface PracticeDraft extends Omit<
  PracticeView,
  "id" | "solutions" | "offers" | "industries" | "work"
> {
  slug: PracticeSlug;
  solutions: readonly SolutionSlug[];
  industries: readonly IndustrySlug[];
  provenance: DraftProvenance;
}

const consulting: PracticeDraft = {
  slug: "consulting",
  title: practiceDisplayName("Consulting"),
  summary: "Clarity, transformation choices, roadmaps and architecture before expensive execution.",
  seo: seo(
    "Vitalos Consulting",
    "Technology strategy, assessments, architecture and transformation roadmaps that end in decisions and implementable direction.",
  ),
  proposition:
    "Consulting helps you decide what should change, why it matters, what the target state should be and how technology, data and AI should enable it. Every engagement ends with a clear next step, in order, with its dependencies and a way to measure success.",
  problems: [
    "Parts of the business need modernising, but there is no coherent plan.",
    "Nobody can say with confidence what is wrong, risky or holding the platform back.",
    "Leadership is unsure whether the organisation, its data and its controls are ready for AI.",
    "Technology investment over the next one to three years needs a sequenced, defensible roadmap.",
    "Architecture or integration decisions are unresolved and implementation is about to start.",
    "Requirements are contested, incomplete or likely to change materially.",
  ],
  capabilities: [
    "Technology strategy and transformation",
    "Digital transformation",
    "AI strategy and adoption",
    "Technology assessments",
    "Enterprise and solution architecture",
    "Operating model design",
    "Business process transformation",
    "Transformation roadmaps",
    "Technology due diligence",
    "Programme inception and governance",
  ],
  body: richText(
    "practice-consulting-body",
    h2("Decisions, not slideware"),
    p(
      "Consulting must produce decisions and implementable direction. Every advisory engagement should answer what you should do next, why, in what order, with what dependencies, and how success will be measured.",
    ),
    h2("Discovery when it reduces risk"),
    p(
      "Discovery exists to reduce uncertainty, not to create billable steps. It is the right start when the problem is unclear, several departments or systems are affected, legacy behaviour is poorly understood, data or AI readiness is unknown, or the investment is large enough that you need evidence before committing. A clear, low-risk build can go straight to Engineering.",
    ),
    h2("How Consulting works with the other practices"),
    p(
      "Consulting is often the front door to larger programmes. Its roadmaps and architecture are written to be delivered by Engineering, AI & Data, Experience and Managed Services, so advice stays connected to what can actually be built and operated.",
    ),
    p(
      "AI appears in Consulting as strategy, opportunity identification, operating model, governance, adoption and the business case.",
    ),
    p("Where an assessment finds that Vitalos should not implement the solution, we say so."),
  ),
  solutions: [
    "ai-transformation",
    "business-process-modernisation",
    "digital-product-transformation",
    "application-modernisation",
    "data-intelligence-transformation",
    "technology-recovery-reliability",
  ],
  industries: ["health-care", "retail-commerce-consumer", "operations-industry-logistics"],
  cta: cta("Discuss a transformation challenge", "project"),
  provenance: drafted([
    cite(3, "4. Vitalos Consulting"),
    cite(3, "4.1 Core capabilities"),
    cite(3, "4.2 Initial consulting offers"),
    cite(3, "4.3 Consulting success criterion"),
    cite(3, "3.1 Consulting-led entry"),
    cite(3, "3.4 The “no unnecessary friction” policy"),
    cite(3, "6.3 AI horizontal model"),
    cite(3, "13.3 Commercial behaviour"),
    cite(8, "10. Practice page architecture"),
  ]),
};

const engineering: PracticeDraft = {
  slug: "engineering",
  title: practiceDisplayName("Engineering"),
  summary: "Serious production software, modernisation, platforms, integration and reliability.",
  seo: seo(
    "Vitalos Engineering",
    "Production software, application modernisation, platforms, integration, cloud and reliability engineering.",
  ),
  proposition:
    "Engineering designs, builds, integrates, modernises and improves production software and platforms. You can come to us directly with a clear need, or continue from discovery, with architecture, testing, security, documentation and operational handover built into the work.",
  problems: [
    "A new product, portal, workflow platform or application is needed.",
    "Ageing software holds the organisation back and is hard to change.",
    "Platforms, services and data flows are disconnected, so people re-key information and hand work over by hand.",
    "Infrastructure, deployments and observability make releases slow or risky.",
    "A product is slow, unstable, unfinished or poorly engineered.",
    "Defects and operational risk undermine confidence in every release.",
  ],
  capabilities: [
    "Software and product engineering",
    "Application modernisation",
    "Platform engineering",
    "Cloud engineering and DevOps",
    "API and systems integration",
    "Architecture",
    "Quality engineering",
    "Reliability engineering and SRE",
    "Performance engineering",
    "Engineering enablement",
  ],
  body: richText(
    "practice-engineering-body",
    h2("Built for production"),
    p(
      "Fast must never mean careless, and enterprise must never mean unnecessarily complicated. Vitalos Engineering aims to be known for strong architecture, pragmatic implementation, production readiness, documentation, testing, security awareness and operational handover.",
    ),
    h2("How we engineer"),
    p(
      "Work moves through version control, peer review, automated checks and controlled environments, so evidence builds up continuously instead of risk accumulating until the end. An increment is done when:",
    ),
    ul(
      "its acceptance criteria are met and the relevant tests pass;",
      "it has been peer reviewed and its security and privacy requirements are satisfied;",
      "observability covers material production paths;",
      "operational and documentation changes are complete, with migrations and rollback considered where relevant;",
      "no critical defect or unowned material risk remains.",
    ),
    h2("Direct engineering, with judgement"),
    p(
      "Clients may come directly for engineering when the objective, requirements, constraints, decision-makers and dependencies are clear enough. We do not invent a discovery phase, but we stop and recommend one when the risk of building the wrong thing becomes material.",
    ),
    h2("How Engineering works with the other practices"),
    p(
      "Engineering takes work forward from Consulting, AI & Data and Experience, and hands live systems to Managed Services through a formal transition. AI appears here as AI-enabled products, agents, integrations, inference services and secure application architecture.",
    ),
  ),
  solutions: [
    "application-modernisation",
    "digital-product-transformation",
    "business-process-modernisation",
    "ai-transformation",
    "data-intelligence-transformation",
    "technology-recovery-reliability",
  ],
  industries: [
    "health-care",
    "retail-commerce-consumer",
    "operations-industry-logistics",
    "growth-technology",
  ],
  cta: cta("Discuss an engineering challenge", "engineering"),
  provenance: drafted([
    cite(3, "5. Vitalos Engineering"),
    cite(3, "5.1 Core capabilities"),
    cite(3, "5.2 Initial engineering offers"),
    cite(3, "5.3 Engineering positioning"),
    cite(3, "3.2 Engineering-led entry"),
    cite(3, "6.3 AI horizontal model"),
    cite(5, "5.2 Engineer"),
    cite(5, "Direct engineering rule"),
    cite(8, "10. Practice page architecture"),
    cite(11, "14. Practice template — generic"),
  ]),
};

const aiData: PracticeDraft = {
  slug: "ai-data",
  title: practiceDisplayName("AI & Data"),
  summary: "AI and data from opportunity and foundations through production and managed operation.",
  seo: seo(
    "Vitalos AI & Data",
    "Find valuable AI opportunities, build the data foundations, prototype quickly, then engineer and operate production AI responsibly.",
  ),
  proposition:
    "We help organisations identify valuable AI opportunities, build the data foundations, prototype quickly, engineer production systems and operate them responsibly. AI is used where it creates a measurable business or user outcome and can be governed.",
  problems: [
    "Leadership wants measurable AI value but has no safe, prioritised route from experimentation to production.",
    "AI pilots are scattered and few have made it into production.",
    "Data sits across several systems and is too fragmented or low-confidence to support decisions or AI.",
    "Reporting and management information cannot be trusted.",
    "Governance, privacy, security and human oversight of AI use are unclear.",
  ],
  capabilities: [
    "AI strategy and transformation",
    "Generative AI",
    "AI agents and agentic workflows",
    "Machine learning",
    "Intelligent automation",
    "Data engineering, data platforms and data quality",
    "Analytics and business intelligence",
    "Enterprise AI integration",
    "AI and data governance",
    "Model and AI operations",
  ],
  body: richText(
    "practice-ai-data-body",
    h2("From opportunity to production"),
    p(
      "AI follows one signature journey: AI Opportunity Assessment, then a Prototype, then Production, then Managed AI. Each stage ends with a decision: is there a use case worth testing, did the evidence justify production investment, is the system ready for controlled live use, and is it still delivering value safely.",
    ),
    h2("How we approach AI"),
    ul(
      "No AI for AI's sake: every use case needs a business or user outcome.",
      "Prototype evidence does not automatically mean production readiness.",
      "Data readiness, security, privacy and human oversight are made explicit.",
      "Bounded, measurable workflows come before broad autonomous systems.",
      "Evaluation criteria are defined before production launch.",
      "Operational cost, reliability and vendor dependence are understood up front.",
      "We stay pragmatic about technology and vendors rather than tying the work to one model provider.",
    ),
    h2("Data foundations"),
    p(
      "Useful analytics and AI depend on data that is connected, cleaned, modelled and governed. Data work covers source ownership and lineage, quality expectations, schema and contract management, access control, retention and deletion rules, monitoring for pipeline failure and freshness, and documented definitions for the metrics that matter.",
    ),
    h2("AI across every practice"),
    p(
      "AI & Data is a specialist practice and a horizontal capability. Consulting shapes AI strategy and governance, Engineering builds AI into products and integrations, Experience designs conversational interfaces, intelligent search and human-centred AI, and Managed Services monitors, evaluates and improves live AI.",
    ),
  ),
  solutions: [
    "ai-transformation",
    "data-intelligence-transformation",
    "business-process-modernisation",
  ],
  industries: [
    "health-care",
    "retail-commerce-consumer",
    "operations-industry-logistics",
    "growth-technology",
  ],
  cta: cta("Discuss an AI opportunity", "ai"),
  provenance: drafted([
    cite(3, "6. Vitalos AI & Data"),
    cite(3, "6.1 Core capabilities"),
    cite(3, "6.2 Initial AI & Data offers"),
    cite(3, "6.3 AI horizontal model"),
    cite(3, "11.1 Journey"),
    cite(3, "11.2 AI engagement principles"),
    cite(5, "13.2 Data engineering controls"),
    cite(8, "10. Practice page architecture"),
    cite(11, "15. Vitalos AI & Data — flagship practice mockup"),
  ]),
};

const experience: PracticeDraft = {
  slug: "experience",
  title: practiceDisplayName("Experience"),
  summary: "Human-centred products, services, commerce and accessible digital experiences.",
  seo: seo(
    "Vitalos Experience",
    "Product discovery, research, service and UX design, design systems, commerce and accessible digital experiences connected to engineering.",
  ),
  proposition:
    "Experience shapes how customers, employees and partners use digital services. It connects user needs, service design, product strategy and engineering so that technology is useful, understandable and adopted, and designs can be delivered within real constraints.",
  problems: [
    "A new product needs defining before major engineering investment.",
    "Usability, accessibility or conversion friction is losing customers or slowing service.",
    "Customer self-service is fragmented and disconnected from the operational workflows behind it.",
    "The commerce experience, and the systems and processes behind it, need modernising.",
    "Digital products are designed and built inconsistently, without a shared component foundation.",
  ],
  capabilities: [
    "Digital product strategy",
    "Product discovery",
    "User research",
    "Service design",
    "UX and UI design",
    "Design systems",
    "Customer and commerce experience",
    "Accessibility",
    "Content and interaction design",
    "Employee and internal experiences",
  ],
  body: richText(
    "practice-experience-body",
    h2("Design that can be delivered"),
    p(
      "Experience is not a standalone graphic-design department. Its work usually connects to engineering or measurable implementation, so we avoid beautiful prototypes that cannot be delivered within your technology, operational or commercial constraints.",
    ),
    h2("Accessible by default"),
    p(
      "Accessibility is part of design quality, not an after-launch audit. Interfaces are checked against the accessibility target agreed for the engagement before release.",
    ),
    h2("How Experience works with the other practices"),
    p(
      "Experience leads discovery and design for new products, portals and commerce journeys, then works alongside Engineering through build and release. AI appears here as conversational interfaces, intelligent search, personalisation and human-centred AI experience design.",
    ),
  ),
  solutions: ["digital-product-transformation", "business-process-modernisation"],
  industries: ["health-care", "retail-commerce-consumer", "growth-technology"],
  cta: cta("Discuss a product or experience challenge", "project"),
  provenance: drafted([
    cite(3, "7. Vitalos Experience"),
    cite(3, "7.1 Core capabilities"),
    cite(3, "7.2 Initial Experience offers"),
    cite(3, "7.3 Experience + Engineering"),
    cite(3, "6.3 AI horizontal model"),
    cite(5, "11. Mandatory quality gates"),
    cite(8, "10. Practice page architecture"),
  ]),
};

const managedServices: PracticeDraft = {
  slug: "managed-services",
  title: practiceDisplayName("Managed Services"),
  summary:
    "Reliable operation, support and continuous improvement for systems Vitalos builds or responsibly inherits.",
  seo: seo(
    "Vitalos Managed Services",
    "Application care, managed engineering, platform operations, managed AI and data, for systems we build or responsibly take over.",
  ),
  proposition:
    "Managed Services takes ongoing operational responsibility for live systems and keeps improving them. It covers systems Vitalos built and systems others built, but only after an assessment establishes a baseline we can responsibly support.",
  problems: [
    "Live systems need ongoing ownership, but there is no full internal product engineering function.",
    "The internal team needs flexible access to multidisciplinary engineering capacity.",
    "Deployment, monitoring and reliability take more effort than the organisation can sustain.",
    "Products stagnate after launch instead of continuing to improve.",
    "A system built by another supplier needs a new, accountable owner.",
    "Production AI or data pipelines need operating, evaluating and improving under agreed controls.",
  ],
  capabilities: [
    "Application management",
    "Managed engineering",
    "Platform and cloud operations",
    "Site reliability engineering",
    "Monitoring and incident management",
    "Release and deployment support",
    "Continuous improvement",
    "Managed data platforms",
    "Managed AI",
    "Technical support and maintenance",
  ],
  body: richText(
    "practice-managed-services-body",
    h2("Support is an operational commitment"),
    p(
      "“We will support it” is an operational commitment, not a sales phrase. Vitalos does not accept a service level for an inherited system it does not understand.",
    ),
    h2("Taking over systems built by others"),
    p(
      "Before taking responsibility for a third-party or inherited system, we assess ownership and access, architecture, code and quality, security, data, operations, documentation and service expectations. The outcome is one of four: accepted as it is, accepted with conditions and a transition backlog, assessment or rescue needed before service starts, or declined where responsible support is not possible.",
    ),
    h2("Formal service transition"),
    p(
      "Operations are not an informal extension of a project. Before service-level-backed operation begins we agree service boundaries, support contacts, escalation, monitoring, runbooks, access, maintenance responsibilities, known exceptions and any initial remediation.",
    ),
    h2("Improvement, not ticket handling"),
    p(
      "Each service keeps an improvement backlog covering reliability, automation, cost, security, user friction and product evolution. AI appears here as monitoring, incident response, evaluation, cost and quality optimisation and continuous improvement of live AI.",
    ),
  ),
  solutions: ["application-modernisation", "technology-recovery-reliability", "ai-transformation"],
  industries: [
    "health-care",
    "retail-commerce-consumer",
    "operations-industry-logistics",
    "growth-technology",
  ],
  cta: cta("Discuss ongoing support or a takeover", "managed-services"),
  provenance: drafted([
    cite(3, "8. Vitalos Managed Services"),
    cite(3, "8.1 Core capabilities"),
    cite(3, "8.2 Initial managed-service offers"),
    cite(3, "8.3 Systems not built by Vitalos"),
    cite(3, "12.2 Assessment domains"),
    cite(3, "12.3 Possible outcomes"),
    cite(3, "6.3 AI horizontal model"),
    cite(5, "17.2 Service transition"),
    cite(5, "17.4 Continuous improvement"),
    cite(8, "10. Practice page architecture"),
  ]),
};

/** In the order the specs fix (locked `practiceNames`). */
export const practiceDrafts: readonly PracticeDraft[] = [
  consulting,
  engineering,
  aiData,
  experience,
  managedServices,
];
