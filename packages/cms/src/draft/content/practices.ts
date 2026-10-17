/**
 * The five practice pages (Stage 3 §4-8; Stage 8 §10); Labs, the sixth practice, is /labs. Names are locked copy (`practiceDisplayName`);
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
    "Technology Strategy Consulting",
    "Technology strategy, assessments, architecture and transformation roadmaps. Every Vitalos Consulting engagement ends with a clear, ordered next step.",
  ),
  proposition:
    "Consulting helps you decide what should change and how technology, data and AI enable it. Every engagement ends with a clear next step, in order, with dependencies and a success measure.",
  problems: [
    "Parts of the business need modernising, but there is no coherent plan.",
    "Nobody can say with confidence what is wrong, risky or holding the platform back.",
    "Leadership is unsure whether the organisation, data and controls are ready for AI.",
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
      "Consulting must produce decisions and direction you can implement. Each engagement should answer what to do next, why, in what order, with what dependencies and how to measure success.",
    ),
    h2("Discovery when it reduces risk"),
    p(
      "Discovery exists to reduce uncertainty, not to create billable steps. Use it when the problem, legacy behaviour or data and AI readiness is unclear, several systems are affected or a large investment needs evidence; a clear, low-risk build can go straight to Engineering.",
    ),
    h2("Working with the other practices"),
    p(
      "Consulting is often the front door to larger programmes. Its roadmaps and architecture are written so the other practices can build and operate them.",
    ),
    p(
      "In Consulting, AI means strategy, opportunities, operating model, governance, adoption and the business case.",
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
    "Software Engineering Services",
    "Vitalos Engineering designs, builds, integrates and modernises production software and platforms, with testing, security and operational handover built in.",
  ),
  proposition:
    "Engineering designs, builds, integrates, modernises and improves production software and platforms. Come directly with a clear need or from discovery; architecture, testing, security, documentation and operational handover are built in.",
  problems: [
    "A new product, portal, workflow platform or application is needed.",
    "Ageing software holds the organisation back and is hard to change.",
    "Disconnected platforms and data flows force people to re-key information and hand work over manually.",
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
      "Fast must never mean careless, and enterprise must never mean needlessly complicated. We aim for strong architecture, pragmatic implementation, production readiness, testing, security, documentation and handover.",
    ),
    h2("How we engineer"),
    p(
      "Work moves through version control, peer review, automated checks and controlled environments, so evidence builds as we go. An increment is done when:",
    ),
    ul(
      "acceptance criteria are met and relevant tests pass;",
      "it is peer reviewed and meets security and privacy requirements;",
      "observability covers material production paths;",
      "operations and documentation are updated, with migrations and rollback considered where relevant;",
      "no critical defect or unowned material risk remains.",
    ),
    h2("Direct engineering, with judgement"),
    p(
      "Come straight to engineering when the objective, requirements, constraints, decision-makers and dependencies are clear enough. We do not invent discovery, but we stop and recommend it when building the wrong thing becomes a material risk.",
    ),
    h2("Working with the other practices"),
    p(
      "Engineering continues work from the other practices and hands live systems to Managed Services through a formal transition. Here, AI means AI-enabled products, agents, integrations, inference services and secure architecture.",
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
    "AI & Data Consultancy",
    "Find valuable AI opportunities, build data foundations, prototype quickly, then engineer and run production AI responsibly, where outcomes are measurable.",
  ),
  proposition:
    "We help you find valuable AI opportunities, build data foundations, prototype quickly, and engineer and run production systems responsibly. We use AI where it creates measurable outcomes and can be governed.",
  problems: [
    "Leadership wants measurable AI value but has no safe, prioritised route from experimentation to production.",
    "AI pilots are scattered and few have made it into production.",
    "Data across several systems is too fragmented or low-confidence to support decisions or AI.",
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
      "AI follows one journey: AI Opportunity Assessment, Prototype, Production, then Managed AI. Each stage ends with a decision: worth testing, worth production investment, ready for controlled live use, still delivering value safely.",
    ),
    h2("How we approach AI"),
    ul(
      "No AI for AI's sake: every use case needs an outcome.",
      "Prototype evidence is not automatically production readiness.",
      "Data, security, privacy and human oversight are explicit.",
      "Bounded, measurable workflows before broad autonomy; evaluation criteria before launch.",
      "Cost, reliability and vendor dependence understood early; not tied to one model provider.",
    ),
    h2("Data foundations"),
    p(
      "Useful analytics and AI need data that is connected, cleaned, modelled and governed. That means ownership, lineage, quality, schema contracts, access control, retention and deletion, pipeline monitoring and documented metric definitions.",
    ),
    h2("AI across every practice"),
    p(
      "AI & Data is both a specialist practice and a capability across the firm. Consulting shapes strategy, Engineering builds AI in, Experience designs AI interfaces and Managed Services monitors and improves live AI.",
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
    "Product, Service & UX Design",
    "Product discovery, research, service and UX design, design systems and accessible digital experiences, connected to engineering so they can be delivered.",
  ),
  proposition:
    "Experience shapes how customers, employees and partners use digital services. It connects user needs, design and engineering so technology is useful, adopted and deliverable within real constraints.",
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
      "Experience is not a standalone graphic-design department. Its work usually connects to engineering, so we avoid beautiful prototypes that cannot be delivered within your constraints.",
    ),
    h2("Accessible by default"),
    p(
      "Accessibility is part of design quality, not an after-launch audit. Interfaces are checked against the accessibility target agreed for the engagement before release.",
    ),
    h2("Working with the other practices"),
    p(
      "Experience leads discovery and design for new products, portals and commerce, then works with Engineering through release. Here, AI means conversational interfaces, intelligent search, personalisation and human-centred design.",
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
    "Managed Application & Platform Services",
    "Application care, managed engineering, platform operations and managed AI and data for live systems we build, or take over after a baseline assessment.",
  ),
  proposition:
    "Managed Services takes ongoing responsibility for live systems and keeps improving them. Systems others built are included only after an assessment sets a baseline we can responsibly support.",
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
    h2("Taking over others' systems"),
    p(
      "Before taking on an inherited system, we assess ownership, access, architecture, code, security, data, operations, documentation and service expectations. We then accept, accept with conditions, assess or rescue first, or decline where responsible support is not possible.",
    ),
    h2("Formal service transition"),
    p(
      "Operations are not an informal extension of a project. Before service levels apply, we agree boundaries, contacts, escalation, monitoring, runbooks, access, maintenance, known exceptions and any initial remediation.",
    ),
    h2("Improvement, not ticket handling"),
    p(
      "Each service keeps an improvement backlog: reliability, automation, cost, security, user friction and product evolution. Here, AI means monitoring, incident response, evaluation, optimisation and improvement of live AI.",
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
