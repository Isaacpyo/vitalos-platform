/**
 * Cross-practice solutions (Stage 3 §9; Stage 8 §11). The first five names are locked copy
 * (`solutionNames`, Stage 8 §11 "Initial five"); Technology Recovery & Reliability is the sixth
 * Stage 3 §9 solution play and is not in the locked list, so its title needs owner confirmation.
 */
import { solutionNames } from "../../locked-copy";
import type { SolutionView } from "../../content/types";
import { cta, h2, p, richText, seo, ul } from "../build";
import { cite, drafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import type { IndustrySlug, OfferSlug, PracticeSlug, SolutionSlug } from "../slugs";

export interface SolutionDraft extends Omit<
  SolutionView,
  "id" | "offers" | "practices" | "industries" | "work"
> {
  slug: SolutionSlug;
  offers: readonly OfferSlug[];
  practices: readonly PracticeSlug[];
  industries: readonly IndustrySlug[];
  provenance: DraftProvenance;
}

const [aiTitle, bpmTitle, dptTitle, appModTitle, dataTitle] = solutionNames;

const aiTransformation: SolutionDraft = {
  slug: "ai-transformation",
  title: aiTitle,
  summary: "Turn AI ambition into operational value.",
  seo: seo(
    "AI Transformation",
    "Move from scattered AI pilots to governed, production AI that creates measurable value.",
  ),
  problemStatement:
    "Organisations face pressure to adopt AI, but value depends on choosing the right use cases, having data that is ready, governing the risk, integrating with real workflows and running reliably in production. Leadership wants measurable results without a safe, prioritised route from experimentation to production.",
  signals: [
    "AI pilots are scattered across teams and few have reached production.",
    "The return on AI investment is unclear.",
    "Important workflows are still manual even where AI could help.",
    "The data AI would need is fragmented or of uncertain quality.",
    "Nobody is sure what governance, privacy and human oversight AI use requires.",
    "Prototypes that impressed in a demonstration stall before production.",
  ],
  impact:
    "Without a prioritised route, AI effort spreads across disconnected experiments that never reach live use. Data, security and governance gaps surface late, and operational cost, reliability and dependence on a single vendor are discovered only after commitments have been made.",
  approach: richText(
    "solution-ai-approach",
    p(
      "Successful AI transformation needs more than a model. It needs a value strategy, data readiness, product and engineering work, Responsible AI, change and adoption, and managed operation once the capability is live.",
    ),
    h2("One team across practices"),
    p(
      "Consulting identifies and prioritises opportunities and builds the business case. AI & Data designs, evaluates and governs the capability. Engineering integrates and secures it in production. Managed Services operates, evaluates and improves it. Experience joins where the interface matters. You work with one accountable engagement lead throughout.",
    ),
    h2("Principles we hold to"),
    ul(
      "Every use case needs a business or user outcome.",
      "Evaluation criteria are defined before production launch.",
      "Bounded, measurable workflows come before broad autonomous systems.",
      "Data readiness, security, privacy and human oversight are explicit decisions.",
    ),
  ),
  phases: [
    {
      title: "Assess",
      description:
        "Identify where AI could create value, and the readiness gaps in data, process, controls and skills.",
    },
    {
      title: "Prioritise",
      description:
        "Rank opportunities by value, feasibility, data readiness and risk, and choose the use case worth testing.",
    },
    {
      title: "Prototype",
      description:
        "Test the strongest business and technical hypothesis quickly, against evaluation criteria agreed in advance.",
    },
    {
      title: "Production",
      description:
        "Engineer a secure, integrated and observable capability, with human oversight and fallback behaviour designed in.",
    },
    {
      title: "Scale",
      description:
        "Extend the capability across workflows, teams, systems or business units where further adoption creates value.",
    },
    {
      title: "Operate",
      description:
        "Monitor, evaluate, optimise and govern the live capability, reviewing value, quality and risk continuously.",
    },
  ],
  offers: ["ai-opportunity-assessment", "ai-prototype-sprint"],
  practices: ["consulting", "ai-data", "engineering", "managed-services"],
  industries: [
    "health-care",
    "retail-commerce-consumer",
    "operations-industry-logistics",
    "growth-technology",
  ],
  faq: [
    {
      question: "Do we have to start with an assessment?",
      answer:
        "Not always. Where data or readiness is uncertain, an AI Opportunity Assessment is the responsible start, because it tests feasibility, quality and risk before you commit to production. If the use case is already clear and the data is understood, we can move to a prototype.",
    },
    {
      question: "Will a successful prototype go straight into production?",
      answer:
        "No. Prototype evidence does not automatically mean production readiness. Production AI needs evaluation, monitoring, security and human-oversight decisions appropriate to the use case, and prototype work does not include production hardening unless that is agreed.",
    },
    {
      question: "Are you tied to one AI model provider?",
      answer:
        "No. We stay pragmatic about technology and vendors, and we make operational cost, reliability and provider dependence part of the design rather than an afterthought.",
    },
    {
      question: "How are model, API and cloud usage costs handled?",
      answer:
        "Usage costs are kept visible: they are separated from professional fees or capped by agreement, so a technically successful system does not become an unexpected cost.",
    },
    {
      question: "Will you be able to tell us where our data goes?",
      answer:
        "That is the aim: Vitalos should be able to answer which model or provider processes your data, whether it is used for provider training, where it is stored, what retention applies, what tools and permissions an agent has, how outputs are evaluated and what happens when the model fails.",
    },
  ],
  cta: cta("Start with an AI Opportunity Assessment", "ai"),
  provenance: drafted([
    cite(3, "9. Cross-Practice Solution Plays"),
    cite(3, "11.1 Journey"),
    cite(3, "11.2 AI engagement principles"),
    cite(3, "3.3 When discovery becomes mandatory"),
    cite(4, "AI commercial guardrails"),
    cite(6, "9. AI trust & Responsible AI"),
    cite(8, "11. Solutions architecture"),
    cite(11, "16. Solution template"),
  ]),
};

const businessProcess: SolutionDraft = {
  slug: "business-process-modernisation",
  title: bpmTitle,
  summary: "Redesign the work, then automate and integrate it.",
  seo: seo(
    "Business Process Modernisation",
    "Redesign manual, fragmented operations, then automate and integrate them so the business can grow.",
  ),
  problemStatement:
    "Manual, slow or fragmented workflows create cost, delay and risk. When critical processes depend on spreadsheets, re-keying, email chains and disconnected tools, operations limit growth and service quality instead of supporting them.",
  signals: [
    "Critical processes depend on spreadsheets, manual re-keying or email chains.",
    "The same information is entered into several systems by hand.",
    "Handoffs between teams or systems cause delays and errors.",
    "Leaders cannot see how work is flowing until it is too late to act.",
    "Growing volume means adding people to the same manual steps.",
  ],
  impact:
    "Fragmented operations add cost and delay to every transaction, introduce errors at each manual handoff and make service quality depend on individual effort. They also hide the operational data leaders need to improve the business.",
  approach: richText(
    "solution-bpm-approach",
    p(
      "We start from the process, not the technology: map how the work happens today, redesign it, then use software, integration, automation and AI where each helps. Analytics show whether the change worked.",
    ),
    h2("One team across practices"),
    p(
      "Consulting leads process discovery and redesign. Engineering builds and integrates the systems. AI & Data adds intelligent automation and operational intelligence. Experience makes the new workflow usable for the people who run it.",
    ),
    h2("Automation that stays reliable"),
    p(
      "Deterministic workflow automation, systems integration and AI are combined deliberately. Integrations are validated for failure modes, retries and dependence on external systems before they carry live work.",
    ),
  ),
  phases: [
    {
      title: "Discover",
      description:
        "Map the current process, the people and systems involved, the pain points and the measures that matter.",
    },
    {
      title: "Redesign the process",
      description:
        "Define the target workflow before choosing technology, removing steps rather than automating them.",
    },
    {
      title: "Automate and integrate",
      description:
        "Build the software, integrations and automation the redesigned workflow needs, with AI where it adds value.",
    },
    {
      title: "Measure",
      description:
        "Compare the live process against its baseline using agreed operational measures.",
    },
    {
      title: "Improve",
      description:
        "Extend automation to adjacent processes and keep refining the workflow as the business changes.",
    },
  ],
  offers: [
    "digital-transformation-discovery",
    "business-process-automation",
    "systems-integration",
  ],
  practices: ["consulting", "engineering", "ai-data", "experience"],
  industries: ["health-care", "retail-commerce-consumer", "operations-industry-logistics"],
  faq: [
    {
      question: "Is this just buying automation software?",
      answer:
        "No. The work starts with how the process should run. Software, integration and automation follow the redesign, so the result is a better workflow rather than a faster version of the old one.",
    },
    {
      question: "Do you replace our existing systems?",
      answer:
        "Only where replacement is the right answer. Often the bigger gain comes from connecting the platforms you already have so information flows automatically between them.",
    },
    {
      question: "Where does AI fit?",
      answer:
        "AI is combined with deterministic workflow automation and software integration where it creates measurable value. Bounded, measurable workflows come first.",
    },
    {
      question: "Who owns the process after go-live?",
      answer:
        "Ownership after the engagement is made explicit before it ends. Your team can take over with documented handover, or Vitalos can continue to operate and improve the workflow under a defined service.",
    },
  ],
  cta: cta("Discuss an operations challenge", "project"),
  provenance: drafted([
    cite(3, "9. Cross-Practice Solution Plays"),
    cite(3, "2.1 How the layers connect"),
    cite(2, "1. Business Process Transformation"),
    cite(2, "4.1 Positive Fit Signals"),
    cite(3, "6.2 Initial AI & Data offers"),
    cite(3, "15.3 Definition of done"),
    cite(5, "6.1 Validation"),
    cite(8, "11. Solutions architecture"),
  ]),
};

const digitalProduct: SolutionDraft = {
  slug: "digital-product-transformation",
  title: dptTitle,
  summary: "Discover, design, engineer, launch and improve a digital product.",
  seo: seo(
    "Digital Product Transformation",
    "Discover, design, engineer and keep improving a digital product that creates measurable customer or employee value.",
  ),
  problemStatement:
    "The organisation needs a new platform, portal, application, commerce experience or digital service, or an existing one that works much better. The product has to create measurable value for customers or employees, not just ship features.",
  signals: [
    "A new digital proposition is planned but its users, journeys and scope are not yet validated.",
    "An existing product has weak adoption or a poor experience.",
    "Customer or employee journeys are fragmented across tools.",
    "The product cannot change quickly enough to keep up with the business.",
    "Previous build attempts stalled or became hard to maintain.",
  ],
  impact:
    "Building before the problem and users are understood wastes engineering investment. Products that are hard to use are not adopted, and products that cannot evolve after launch stagnate.",
  approach: richText(
    "solution-dpt-approach",
    p(
      "Experience leads discovery and design, Engineering builds for production, and Consulting keeps the product tied to the business outcome. Discovery, design and engineering run as one engagement rather than separate handoffs.",
    ),
    h2("From discovery to continuous improvement"),
    p(
      "Product discovery validates the problem, users, journeys and scope before major build. Engineering then delivers working increments with testing, security and accessibility checks, and the product keeps improving after launch.",
    ),
  ),
  phases: [
    {
      title: "Discover",
      description:
        "Validate the problem, users, journeys and scope, and set the direction for a prototype and delivery backlog.",
    },
    {
      title: "Design",
      description:
        "Design the service, journeys and interface, and the technical architecture, ready for build.",
    },
    {
      title: "Engineer",
      description:
        "Build in working, tested increments through controlled environments, with peer review and automated checks.",
    },
    {
      title: "Launch",
      description:
        "Validate the release for function, security, performance and accessibility, then move to production with rollback planned.",
    },
    {
      title: "Improve",
      description:
        "Review outcomes against measures and keep evolving the product through continuous improvement.",
    },
  ],
  offers: ["product-discovery", "custom-digital-product", "customer-experience-transformation"],
  practices: ["experience", "engineering", "consulting"],
  industries: ["retail-commerce-consumer", "health-care", "growth-technology"],
  faq: [
    {
      question: "Can we go straight to build?",
      answer:
        "Yes, when the product objective is clear, requirements are understood well enough, constraints are known, decision-makers are available and dependencies are understood. Otherwise a short product discovery is the safer start.",
    },
    {
      question: "Do you build brochure websites?",
      answer:
        "Vitalos builds web platforms, portals, commerce and digital products. Routine brochure websites are generally not part of what we offer.",
    },
    {
      question: "What happens after launch?",
      answer:
        "You can take over with documented handover, or keep Vitalos engaged for continuous product improvement against an agreed roadmap.",
    },
    {
      question: "Is accessibility included?",
      answer:
        "Yes. Interfaces are checked against the accessibility target agreed for the engagement as part of validation before release.",
    },
  ],
  cta: cta("Discuss a digital product", "project"),
  provenance: drafted([
    cite(3, "9. Cross-Practice Solution Plays"),
    cite(2, "4. Digital Product Engineering"),
    cite(3, "3.2 Engineering-led entry"),
    cite(3, "7.2 Initial Experience offers"),
    cite(3, "14. Small-Work Policy and Brand Protection"),
    cite(5, "6.1 Validation"),
    cite(8, "11. Solutions architecture"),
  ]),
};

const applicationModernisation: SolutionDraft = {
  slug: "application-modernisation",
  title: appModTitle,
  summary: "Modernise in controlled stages towards a platform you can keep changing.",
  seo: seo(
    "Application Modernisation",
    "Assess, re-architect and progressively modernise legacy applications, then operate them reliably.",
  ),
  problemStatement:
    "Ageing applications and architecture constrain growth, reliability and the speed of change. They are expensive to maintain, risky to alter and hard to integrate with the rest of the business.",
  signals: [
    "Small changes to a core application take a long time or carry unusual risk.",
    "Only a few people understand how the system works.",
    "Integration with newer platforms is difficult or impossible.",
    "Reliability, security patching or hosting are becoming a concern.",
    "Maintenance absorbs budget that should fund improvement.",
  ],
  impact:
    "Legacy constraints slow every initiative that depends on the system, increase operational and security risk, and make the organisation dependent on knowledge held by a few people.",
  approach: richText(
    "solution-appmod-approach",
    p(
      "Modernisation starts with an honest assessment of architecture, dependencies and migration constraints. From there we agree a target architecture and modernise, replace or progressively refactor in controlled stages, so the business keeps running while the system changes.",
    ),
    h2("One team across practices"),
    p(
      "Consulting leads assessment and target architecture. Engineering migrates and refactors. Managed Services takes over operation through a formal transition, so the modernised system does not stagnate.",
    ),
  ),
  phases: [
    {
      title: "Assess",
      description:
        "Establish the architecture, technical debt, dependencies, risks and migration constraints of the current system.",
    },
    {
      title: "Target architecture",
      description:
        "Agree the destination and the sequence of steps, with dependencies and decision points recorded.",
    },
    {
      title: "Migrate and refactor",
      description:
        "Modernise, replace or progressively refactor in stages, with migration and rollback planned for each.",
    },
    {
      title: "Transition",
      description:
        "Hand over documentation, runbooks, monitoring and support ownership through a service transition.",
    },
    {
      title: "Operate",
      description:
        "Run, maintain and keep improving the modernised application, under Application Care or your own team.",
    },
  ],
  offers: [
    "technology-health-assessment",
    "application-modernisation",
    "managed-engineering-application-care",
  ],
  practices: ["consulting", "engineering", "managed-services"],
  industries: ["operations-industry-logistics", "health-care", "retail-commerce-consumer"],
  faq: [
    {
      question: "Do we have to replace everything at once?",
      answer:
        "No. Modernisation can replace, re-platform or progressively refactor parts of the system in stages, chosen by risk and value.",
    },
    {
      question: "Why start with an assessment?",
      answer:
        "Material legacy complexity is one of the cases where going straight to build is risky. An assessment establishes the architecture, dependencies and migration constraints first.",
    },
    {
      question: "Who supports the system during and after modernisation?",
      answer:
        "Responsibility is explicit at every stage. After transition, your team can take over with documented handover or Vitalos can operate it under Application Care.",
    },
    {
      question: "Can you modernise a system another supplier built?",
      answer:
        "Yes. For an inherited system the assessment also covers ownership and access, code and quality, security, data, operations and documentation before Vitalos commits to a plan or a service.",
    },
  ],
  cta: cta("Discuss a legacy system", "engineering"),
  provenance: drafted([
    cite(3, "9. Cross-Practice Solution Plays"),
    cite(2, "3. Legacy Modernisation"),
    cite(3, "12.2 Assessment domains"),
    cite(3, "3.3 When discovery becomes mandatory"),
    cite(3, "5.2 Initial engineering offers"),
    cite(5, "17.2 Service transition"),
    cite(8, "11. Solutions architecture"),
  ]),
};

const dataIntelligence: SolutionDraft = {
  slug: "data-intelligence-transformation",
  title: dataTitle,
  summary: "Build the foundation, then the intelligence on top of it.",
  seo: seo(
    "Data & Intelligence Transformation",
    "Connect, clean, model and govern your data, then build the reporting and AI capability decisions depend on.",
  ),
  problemStatement:
    "Data exists across several systems but is fragmented, low-confidence or difficult to turn into decisions. Management lacks reliable operational intelligence, and the data is not ready to support AI.",
  signals: [
    "Different reports give different answers to the same question.",
    "Producing management information involves manual spreadsheet work.",
    "Data sits in several systems with no agreed definitions or ownership.",
    "AI initiatives stall because the data they need is not ready.",
  ],
  impact:
    "Decisions are made on figures nobody fully trusts, analysts spend their time reconciling data instead of using it, and AI initiatives cannot move beyond experiments.",
  approach: richText(
    "solution-data-approach",
    p(
      "We connect, clean, model and govern the data first, then build reporting, decision systems and AI on a foundation that can be trusted.",
    ),
    h2("Controls that keep data trustworthy"),
    ul(
      "Source ownership and lineage.",
      "Data quality expectations and monitoring for pipeline failure and freshness.",
      "Schema and contract management.",
      "Access control, minimisation, and retention and deletion rules.",
      "Documented business definitions for the metrics that matter.",
    ),
    h2("One team across practices"),
    p(
      "AI & Data leads the data and intelligence work, Consulting ties it to the decisions the business needs to make, and Engineering integrates the source systems.",
    ),
  ),
  phases: [
    {
      title: "Assess",
      description:
        "Map data sources, quality, ownership and the decisions the data should support.",
    },
    {
      title: "Foundation",
      description:
        "Connect, clean, model and govern the data the business and later AI work depend on.",
    },
    {
      title: "Model and integrate",
      description:
        "Integrate source systems and model the data around agreed business definitions.",
    },
    {
      title: "Intelligence",
      description:
        "Deliver trusted reporting, metrics and decision systems, and advanced analytics or AI where the foundation supports them.",
    },
    {
      title: "Managed data",
      description:
        "Operate pipelines, analytics workflows and quality controls so the foundation stays reliable.",
    },
  ],
  offers: ["data-bi-modernisation"],
  practices: ["ai-data", "consulting", "engineering"],
  industries: ["retail-commerce-consumer", "operations-industry-logistics", "health-care"],
  faq: [
    {
      question: "Do we need a new data platform?",
      answer:
        "Not necessarily. The assessment shows whether connecting and governing existing sources is enough, or whether a new platform is justified.",
    },
    {
      question: "Is this preparation for AI?",
      answer:
        "Often. AI adoption depends on data foundations, governance and systems integration. Good reporting is valuable in its own right, and it is also the base that later AI work builds on.",
    },
    {
      question: "How do you handle data quality and ownership?",
      answer:
        "Each important source gets an owner, lineage and quality expectations, and key metrics get documented definitions, so reports can be traced back to their data.",
    },
    {
      question: "Where does AI come in?",
      answer:
        "Once the foundation can be trusted, advanced analytics or AI can be built on it, under the same evaluation, monitoring and governance controls as any other production AI.",
    },
  ],
  cta: cta("Discuss a data challenge", "ai"),
  provenance: drafted([
    cite(3, "9. Cross-Practice Solution Plays"),
    cite(2, "5. Data & Operational Intelligence"),
    cite(5, "13.1 AI lifecycle"),
    cite(2, "11. Market-Entry Wedge"),
    cite(3, "6.2 Initial AI & Data offers"),
    cite(5, "13.2 Data engineering controls"),
    cite(8, "11. Solutions architecture"),
  ]),
};

const technologyRecovery: SolutionDraft = {
  slug: "technology-recovery-reliability",
  title: "Technology Recovery & Reliability",
  summary:
    "Triage a critical platform, establish a known baseline, stabilise and remediate, then operate it.",
  seo: seo(
    "Technology Recovery & Reliability",
    "Stabilise and recover a critical platform that is unstable, slow or unfinished, then keep it reliable.",
  ),
  problemStatement:
    "A critical platform is unstable, slow or unfinished. It may have been built by another supplier, documentation may be thin, and the business depends on it working.",
  signals: [
    "Incidents and outages are frequent or hard to diagnose.",
    "A project has stalled and the product is unfinished.",
    "Performance is degrading as use grows.",
    "The original supplier or team is no longer available.",
    "Nobody can say with confidence what is safe to change.",
  ],
  impact:
    "An unstable critical platform disrupts operations and customers, consumes the people who keep it running and blocks every improvement that depends on it.",
  approach: richText(
    "solution-recovery-approach",
    p(
      "Recovery starts with triage and an assessment that creates a known technical baseline. Stabilisation and controlled remediation follow, in priority order, before Vitalos accepts ongoing operational responsibility.",
    ),
    h2("Honest about outcomes"),
    p(
      "Before accepting a service commitment for an inherited system, we assess ownership and access, architecture, code, security, data, operations and documentation. If the risk, access or legality make responsible support impossible, we say so.",
    ),
  ),
  phases: [
    {
      title: "Triage",
      description: "Understand the immediate risk and protect what the business depends on today.",
    },
    {
      title: "Assess",
      description:
        "Establish a known baseline: architecture, code quality, security posture, operations and documentation.",
    },
    {
      title: "Stabilise",
      description: "Address the causes of instability that matter most, in priority order.",
    },
    {
      title: "Remediate",
      description:
        "Work through a prioritised recovery plan, with each change reviewed, tested and reversible.",
    },
    {
      title: "Operate",
      description:
        "Move into managed engineering or application care with a defined service boundary.",
    },
  ],
  offers: [
    "engineering-rescue",
    "technology-health-assessment",
    "managed-engineering-application-care",
  ],
  practices: ["engineering", "managed-services", "consulting"],
  industries: ["growth-technology", "retail-commerce-consumer", "operations-industry-logistics"],
  faq: [
    {
      question: "Will you take over a system another supplier built?",
      answer:
        "Yes, after an assessment. Acceptance is never automatic: we need to understand architecture, code ownership, dependencies, security, deployment, data responsibilities, known incidents and documentation first.",
    },
    {
      question: "Can you guarantee the system will be fixed?",
      answer:
        "We do not promise outcomes before the assessment. It establishes what is wrong and what recovery involves, and it can conclude that a rescue is needed before any service starts, or that responsible support is not possible.",
    },
    {
      question: "What if the right answer is to rebuild?",
      answer:
        "Then the assessment says so. Recovery, modernisation and replacement are all legitimate outcomes, chosen on evidence.",
    },
    {
      question: "What happens once the system is stable?",
      answer:
        "It moves into managed engineering or application care within a defined service boundary, or back to your own team with documented handover.",
    },
  ],
  cta: cta("Discuss an unstable system", "engineering"),
  provenance: drafted(
    [
      cite(3, "9. Cross-Practice Solution Plays"),
      cite(3, "2.1 How the layers connect"),
      cite(3, "5.2 Initial engineering offers"),
      cite(3, "8.3 Systems not built by Vitalos"),
      cite(3, "12.3 Possible outcomes"),
      cite(3, "13.3 Commercial behaviour"),
      cite(4, "Transition choices"),
    ],
    "Title not in locked copy: Stage 3 §9 lists six solution plays, Stage 8 §11 locks the initial five. The owner decides whether this sixth solution is published.",
  ),
};

export const solutionDrafts: readonly SolutionDraft[] = [
  aiTransformation,
  businessProcess,
  digitalProduct,
  applicationModernisation,
  dataIntelligence,
  technologyRecovery,
];
