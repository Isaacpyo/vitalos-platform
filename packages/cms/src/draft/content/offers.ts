/**
 * The Stage 4 offer catalogue (Stage 4 "Initial Offer Pricing Architecture"; Stage 3 §10; Stage 8
 * §12). Twelve names are locked copy (`offerNames`); Product Discovery is in the Stage 3 and
 * Stage 4 catalogues but not in the locked Stage 8 set, so its title needs owner confirmation.
 *
 * No prices: offer pages are proposal-led (Stage 8 §12 "Offer-page rule"). The Stage 4 indicative
 * ranges are internal and are deliberately not used. Duration categories are coarse and
 * provisional (see `durationCategoryList`).
 */
import { offerNames } from "../../locked-copy";
import type { OfferView } from "../../content/types";
import { cta, seo } from "../build";
import { cite, drafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import type { OfferSlug, PracticeSlug, SolutionSlug } from "../slugs";

export interface OfferDraft extends Omit<OfferView, "id" | "solutions" | "practices"> {
  slug: OfferSlug;
  solutions: readonly SolutionSlug[];
  practices: readonly PracticeSlug[];
  provenance: DraftProvenance;
}

const name = (title: (typeof offerNames)[number]) => title;

/** Shared client requirements (Stage 3 §15.1 client roles; Stage 5 §4.1 qualification). */
const sponsorAndOwner =
  "A named sponsor, and a business owner who can make decisions and accept the outcome";
const accessToPeople = "Access to the people, processes, systems and data in scope";

const pricingCitation = cite(4, "Initial Offer Pricing Architecture");
const offerRule = cite(8, "12. Offer architecture");
const catalogue = cite(3, "10. Initial Offer Catalogue");

const offers: readonly OfferDraft[] = [
  {
    slug: "digital-transformation-discovery",
    title: name("Digital Transformation Discovery"),
    summary:
      "Turn an ambiguous need to modernise into a coherent, prioritised plan: current state, future state and roadmap.",
    seo: seo(
      "Digital Transformation Discovery",
      "A bounded discovery that turns a broad need to modernise into a current-state view, a future state and a prioritised roadmap.",
    ),
    audience:
      "Leaders who know parts of the business need modernising, where several departments, processes or systems are affected and the right answer is not yet clear.",
    trigger:
      "“We know parts of the business need modernising, but need a coherent plan.” Transformation uncertainty is high, requirements are contested or incomplete, or the investment is large enough that evidence is needed before committing.",
    scope:
      "Vitalos maps how the business operates today: processes, systems, data and pain points. We then define a future-state vision with you and prioritise the initiatives that move towards it, with their dependencies and sequence.",
    outputs: [
      "Current-state analysis",
      "Process and system map",
      "Pain points and their consequences",
      "Future-state vision",
      "Prioritised initiatives",
      "Roadmap with dependencies and sequence",
    ],
    requirements: [sponsorAndOwner, accessToPeople, "Time from the teams whose work is in scope"],
    durationCategory: "short",
    exclusions: [
      "Implementation of the roadmap, which is scoped as its own engagement",
      "Detailed technical design for every initiative",
    ],
    nextStep:
      "The roadmap becomes an implementation programme across Engineering, AI & Data or Experience.",
    solutions: ["business-process-modernisation"],
    practices: ["consulting"],
    cta: cta("Discuss a transformation discovery", "offer"),
    provenance: drafted([
      catalogue,
      cite(3, "4.2 Initial consulting offers"),
      cite(3, "3.1 Consulting-led entry"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "technology-health-assessment",
    title: name("Technology Health Assessment"),
    summary: "Find out what is wrong, risky or holding a platform back, and what to fix first.",
    seo: seo(
      "Technology Health Assessment",
      "A review of architecture, technical debt, security, reliability and performance risk, with a prioritised remediation plan.",
    ),
    audience:
      "Technology and business leaders responsible for a platform whose risk, debt or reliability is uncertain, before deciding whether to modernise, rescue or hand it to a managed service.",
    trigger:
      "“We need to know what is wrong, risky or holding the platform back.” Releases are risky, incidents are rising or a major investment decision depends on the platform.",
    scope:
      "Vitalos reviews the platform's architecture, code and technical debt, security and reliability posture and performance risks, then turns the findings into a prioritised remediation plan.",
    outputs: [
      "Architecture review",
      "Technical debt assessment",
      "Security and reliability observations",
      "Performance risks",
      "Prioritised remediation plan",
    ],
    requirements: [
      sponsorAndOwner,
      "Read access to source code, infrastructure, deployment pipelines and monitoring",
      "Existing documentation and incident history",
    ],
    durationCategory: "short",
    exclusions: [
      "Penetration testing or a formal security audit; the security observations are not a certification",
      "Carrying out the remediation, which is scoped separately",
    ],
    nextStep:
      "Application modernisation, engineering rescue or a managed service, depending on what the assessment finds.",
    solutions: ["application-modernisation", "technology-recovery-reliability"],
    practices: ["consulting", "engineering"],
    cta: cta("Discuss a health assessment", "offer"),
    provenance: drafted([
      catalogue,
      cite(3, "4.2 Initial consulting offers"),
      cite(3, "16.2 Early boundary examples"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "ai-opportunity-assessment",
    title: name("AI Opportunity Assessment"),
    summary:
      "Find the AI opportunities worth building: viable use cases ranked by value, feasibility, data readiness and risk.",
    seo: seo(
      "AI Opportunity Assessment",
      "A focused engagement that ranks viable AI use cases by value, feasibility, data readiness and risk, with a roadmap to prototype.",
    ),
    audience:
      "Leadership teams who know AI matters but do not yet know where it creates value safely, or who have several AI ideas and need to choose between them.",
    trigger:
      "“We know AI matters but do not know where to start.” AI opportunities are unclear, pilots are scattered, or readiness in data, governance and skills is unknown.",
    scope:
      "Vitalos evaluates business processes, opportunity value, data readiness, systems and integration, security and privacy, Responsible AI and operating readiness. The engagement runs Discover, Evaluate, Prioritise, Recommend, and ends with use cases ranked by value, feasibility, data readiness and risk.",
    outputs: [
      "Opportunity map",
      "Prioritised use cases",
      "Feasibility and risk assessment",
      "Prototype recommendations",
      "Adoption roadmap",
      "Executive readout",
    ],
    requirements: [
      sponsorAndOwner,
      accessToPeople,
      "A view of the data that candidate use cases would rely on",
    ],
    durationCategory: "short",
    exclusions: [
      "Building or deploying AI systems, which starts with an AI Prototype Sprint",
      "Return-on-investment promises without evidence",
    ],
    nextStep:
      "An AI Prototype Sprint to test the strongest use case, then Production and Managed AI.",
    solutions: ["ai-transformation"],
    practices: ["consulting", "ai-data"],
    cta: cta("Discuss an AI Opportunity Assessment", "ai"),
    provenance: drafted([
      catalogue,
      cite(3, "6.2 Initial AI & Data offers"),
      cite(3, "11.1 Journey"),
      cite(4, "AI commercial guardrails"),
      pricingCitation,
      offerRule,
      cite(11, "17. Offer template"),
    ]),
  },
  {
    slug: "ai-prototype-sprint",
    title: name("AI Prototype Sprint"),
    summary:
      "Test the highest-value AI hypothesis quickly, with real workflows and data where appropriate, and decide on evidence.",
    seo: seo(
      "AI Prototype Sprint",
      "A bounded sprint that tests the strongest AI use case with a working prototype and evaluation findings.",
    ),
    audience:
      "Organisations with a prioritised AI use case that need to prove value and feasibility before committing to production investment.",
    trigger:
      "A use case looks valuable but its feasibility, data quality or business benefit has not been proven.",
    scope:
      "Vitalos agrees evaluation criteria with you before testing, then builds a bounded prototype against real workflows and data where appropriate, and measures it against those criteria. The sprint answers one question: did the evidence justify production investment?",
    outputs: [
      "Working prototype",
      "Evaluation findings against the agreed criteria",
      "Recommendation on production investment",
      "Known limitations and risks",
    ],
    requirements: [
      sponsorAndOwner,
      "Access to representative data or test cases, or agreement to use synthetic data",
      "People who do the work today, to test against real workflows",
    ],
    durationCategory: "short",
    exclusions: [
      "Production hardening, unless it is explicitly agreed",
      "Uncapped model, API or cloud usage; consumption is separated or capped by agreement",
    ],
    nextStep:
      "Production AI implementation: engineering, integration, security, monitoring and governance of the capability.",
    solutions: ["ai-transformation"],
    practices: ["ai-data", "engineering"],
    cta: cta("Discuss an AI prototype", "ai"),
    provenance: drafted([
      catalogue,
      cite(3, "6.2 Initial AI & Data offers"),
      cite(3, "11.2 AI engagement principles"),
      cite(4, "AI commercial guardrails"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "custom-digital-product",
    title: name("Custom Digital Product"),
    summary:
      "Build a new product, portal, workflow platform or application, designed around measurable user and business outcomes.",
    seo: seo(
      "Custom Digital Product",
      "Design and engineer a new product, portal, workflow platform or application for production.",
    ),
    audience:
      "Organisations that need a defined new product or platform, with product ownership and decision-makers available.",
    trigger:
      "A new platform, portal, operational web application or digital service is needed and its objective is clear enough to build.",
    scope:
      "Experience and Engineering design and build the product in working, tested increments, through controlled environments with peer review and automated checks, and validate it for function, security, performance and accessibility before release.",
    outputs: [
      "Production digital product",
      "Architecture and decision records",
      "Automated tests and release pipeline",
      "Operational documentation and runbooks",
      "Handover or transition to ongoing support",
    ],
    requirements: [
      "A product owner with authority over priorities and acceptance",
      "Understood functional and non-functional requirements, or a discovery first",
      "Access to the systems and data the product integrates with",
    ],
    durationCategory: "long",
    exclusions: [
      "Routine brochure websites",
      "Third-party licences and cloud consumption, which are visible pass-through costs",
    ],
    nextStep:
      "Operate and continuously improve the product, with your team or through managed engineering.",
    solutions: ["digital-product-transformation"],
    practices: ["engineering", "experience"],
    cta: cta("Discuss a new product", "engineering"),
    provenance: drafted([
      catalogue,
      cite(3, "5.2 Initial engineering offers"),
      cite(3, "14.1 Work Vitalos should actively pursue"),
      cite(5, "5.2 Engineer"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "application-modernisation",
    title: name("Application Modernisation"),
    summary:
      "Modernise, replace or progressively refactor ageing software to reduce technical constraint and restore the ability to change.",
    seo: seo(
      "Application Modernisation",
      "Modernise, replace or progressively refactor legacy software in controlled stages.",
    ),
    audience:
      "Technology leaders whose ageing application constrains growth, reliability or integration.",
    trigger:
      "A legacy system is expensive, risky or slow to change, and the business needs it to evolve.",
    scope:
      "Where legacy complexity is material the work starts with an assessment or technical inception. Vitalos then agrees a target architecture and modernises in stages, each with migration, testing and rollback planned.",
    outputs: [
      "Modernised architecture and application",
      "Migration plan and records",
      "Improved test coverage and release pipeline",
      "Updated documentation and runbooks",
    ],
    requirements: [
      sponsorAndOwner,
      "Access to source code, environments and the people who know the current system",
    ],
    durationCategory: "long",
    exclusions: ["A whole-programme fixed price before the assessment has reduced uncertainty"],
    nextStep: "Application Care or platform operations for the modernised system.",
    solutions: ["application-modernisation"],
    practices: ["engineering", "consulting"],
    cta: cta("Discuss a modernisation", "engineering"),
    provenance: drafted([
      catalogue,
      cite(3, "5.2 Initial engineering offers"),
      cite(3, "3.3 When discovery becomes mandatory"),
      cite(4, "Engineering & Transformation Delivery Economics"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "systems-integration",
    title: name("Systems Integration"),
    summary:
      "Connect disconnected platforms, services and data flows so information moves reliably and manual handoffs disappear.",
    seo: seo(
      "Systems Integration",
      "Connect disconnected platforms, services and data flows for reliable automated exchange of information.",
    ),
    audience:
      "Operations and technology leaders whose teams re-key data between systems or depend on fragile manual handoffs.",
    trigger: "Fragmented systems and manual handoffs slow work and introduce errors.",
    scope:
      "Vitalos maps ownership, interfaces and failure modes across the systems involved, then builds integrations validated for failure handling, retries, idempotency and external dependency behaviour.",
    outputs: [
      "Integrated, automated workflows",
      "Interface and data-flow documentation",
      "Monitoring and alerting for integration failures",
      "Runbooks for operating the integrations",
    ],
    requirements: [
      sponsorAndOwner,
      "Access to the systems, APIs and vendor documentation involved",
    ],
    durationCategory: "medium",
    exclusions: ["Licences or API fees for third-party platforms"],
    nextStep: "Further automation or managed integration.",
    solutions: ["business-process-modernisation"],
    practices: ["engineering"],
    cta: cta("Discuss an integration", "engineering"),
    provenance: drafted([
      catalogue,
      cite(3, "5.2 Initial engineering offers"),
      cite(3, "3.3 When discovery becomes mandatory"),
      cite(5, "6.1 Validation"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "business-process-automation",
    title: name("Business Process Automation"),
    summary: "Redesign and automate repeatable operations, combining workflow, integration and AI.",
    seo: seo(
      "Business Process Automation",
      "Redesign manual, repetitive operations and automate them with workflow, integration and AI where it adds value.",
    ),
    audience:
      "Operations leaders running manual, repetitive processes that limit growth or service.",
    trigger: "Manual repetitive operations consume time, add errors and do not scale.",
    scope:
      "Vitalos redesigns the process first, then combines deterministic workflow automation, software integration and AI where each helps, and measures the result against the starting point.",
    outputs: [
      "Redesigned workflow",
      "Automation and integrations in production",
      "Before-and-after measures agreed at the start",
      "Documentation and ownership for the automated process",
    ],
    requirements: [sponsorAndOwner, "The people who run the process today, to redesign it with us"],
    durationCategory: "medium",
    exclusions: ["Automating a process before it has been redesigned"],
    nextStep: "Managed automation, or extending automation to adjacent processes.",
    solutions: ["business-process-modernisation"],
    practices: ["consulting", "engineering", "ai-data"],
    cta: cta("Discuss automating a process", "project"),
    provenance: drafted([
      catalogue,
      cite(3, "6.2 Initial AI & Data offers"),
      cite(2, "1. Business Process Transformation"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "data-bi-modernisation",
    title: name("Data & BI Modernisation"),
    summary: "Create a usable data foundation and the reporting and decision systems built on it.",
    seo: seo(
      "Data & BI Modernisation",
      "Connect, clean, model and govern data, then modernise reporting, metrics and decision systems.",
    ),
    audience:
      "Leaders who cannot trust their reporting, or whose data is too fragmented to support decisions or AI.",
    trigger: "Fragmented or unusable data and poor reporting or decision visibility.",
    scope:
      "Vitalos connects, cleans, models and governs the data required for analytics and AI, then improves operational reporting, metrics and decision systems on that foundation.",
    outputs: [
      "Connected, governed data foundation",
      "Documented definitions for key metrics",
      "Modernised reporting and dashboards",
      "Data quality and pipeline monitoring",
    ],
    requirements: [
      sponsorAndOwner,
      "Owners for the main data sources",
      "Access to the source systems and current reports",
    ],
    durationCategory: "medium",
    exclusions: [
      "Data platform licences and cloud consumption, which are visible pass-through costs",
    ],
    nextStep: "AI implementation or managed data.",
    solutions: ["data-intelligence-transformation"],
    practices: ["ai-data"],
    cta: cta("Discuss data and reporting", "ai"),
    provenance: drafted([
      catalogue,
      cite(3, "6.2 Initial AI & Data offers"),
      cite(3, "2.1 How the layers connect"),
      cite(5, "13.2 Data engineering controls"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "customer-experience-transformation",
    title: name("Customer Experience Transformation"),
    summary:
      "Improve the end-to-end customer digital journey, connected to the processes and systems behind it.",
    seo: seo(
      "Customer Experience Transformation",
      "Redesign the customer digital journey and the workflows behind it, with an implementation roadmap.",
    ),
    audience:
      "Digital, product and customer leaders whose customer journeys are fragmented, hard to use or disconnected from operations.",
    trigger: "A poor customer digital journey is costing adoption, conversion or service quality.",
    scope:
      "Vitalos reviews the journey for usability, accessibility and service friction, redesigns it together with the operational workflow behind it, and sets out how to implement it.",
    outputs: [
      "Evidence-based experience review",
      "Redesigned customer journey",
      "Prioritised improvement plan",
      "Implementation roadmap",
    ],
    requirements: [
      sponsorAndOwner,
      "Access to customers or customer data for research, where appropriate",
    ],
    durationCategory: "medium",
    exclusions: ["Visual redesign that is not connected to the underlying process"],
    nextStep: "Product engineering and continuous optimisation.",
    solutions: ["digital-product-transformation"],
    practices: ["experience", "engineering"],
    cta: cta("Discuss a customer experience", "project"),
    provenance: drafted([
      catalogue,
      cite(3, "7.2 Initial Experience offers"),
      cite(3, "7.3 Experience + Engineering"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "engineering-rescue",
    title: name("Engineering Rescue"),
    summary:
      "Stabilise or complete a slow, unstable, unfinished or poorly engineered product, starting from a known baseline.",
    seo: seo(
      "Engineering Rescue",
      "Stabilise a stalled, unreliable or poorly engineered system with a rescue assessment and controlled remediation.",
    ),
    audience:
      "Organisations whose product is unstable, stalled or poorly engineered, including systems built by another supplier.",
    trigger: "Unstable or unfinished software that the business depends on.",
    scope:
      "The work begins with a rescue assessment that establishes a known technical baseline and a prioritised recovery plan. Vitalos then stabilises the system and carries out controlled remediation.",
    outputs: [
      "Known technical baseline",
      "Prioritised recovery plan",
      "Stabilisation and controlled remediation",
      "Recommendation on modernisation or ongoing support",
    ],
    requirements: [
      "Administrative access to code, infrastructure, accounts and domains",
      "Whatever documentation and incident history exists",
    ],
    durationCategory: "medium",
    exclusions: [
      "A service-level commitment before the assessment is complete",
      "Work that would require bypassing legal, licensing or security obligations",
    ],
    nextStep: "Modernisation, or managed engineering for the stabilised system.",
    solutions: ["technology-recovery-reliability"],
    practices: ["engineering"],
    cta: cta("Discuss a rescue", "engineering"),
    provenance: drafted([
      catalogue,
      cite(3, "5.2 Initial engineering offers"),
      cite(3, "2.1 How the layers connect"),
      cite(3, "12.3 Possible outcomes"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "managed-engineering-application-care",
    title: name("Managed Engineering & Application Care"),
    summary:
      "Ongoing ownership and improvement of live applications: maintenance, fixes, updates, incident support and retained engineering capacity.",
    seo: seo(
      "Managed Engineering & Application Care",
      "Application care and retained engineering capacity that keep live systems supported and improving.",
    ),
    audience:
      "Organisations that need continuity for live systems without a full internal product engineering function, or extra capacity alongside their own team.",
    trigger: "A live system needs ongoing ownership, capacity or continuous improvement.",
    scope:
      "Within an agreed service boundary, Vitalos maintains the application, fixes defects, applies updates, supports incidents and delivers planned improvements. Retained engineering capacity works with your own technology or product team against an improvement roadmap.",
    outputs: [
      "Maintenance, defect fixes and updates within the service boundary",
      "Incident support and monitoring coordination",
      "An improvement backlog and regular service reviews",
      "Retained engineering capacity where agreed",
    ],
    requirements: [
      "For systems Vitalos did not build, a takeover assessment before service begins",
      "Agreed service boundary, contacts and escalation routes",
    ],
    durationCategory: "ongoing",
    exclusions: [
      "Unlimited support outside the defined service boundary",
      "Service levels for an inherited system that has not been assessed",
    ],
    nextStep: "A broader strategic relationship across further services and systems.",
    solutions: ["application-modernisation", "technology-recovery-reliability"],
    practices: ["managed-services", "engineering"],
    cta: cta("Discuss ongoing support", "managed-services"),
    provenance: drafted([
      catalogue,
      cite(3, "8.2 Initial managed-service offers"),
      cite(3, "8.3 Systems not built by Vitalos"),
      cite(4, "Managed Services & Retained Engineering"),
      pricingCitation,
      offerRule,
    ]),
  },
  {
    slug: "product-discovery",
    title: "Product Discovery",
    summary:
      "Define a new product before major engineering investment: validated problem, users, journeys, scope and backlog.",
    seo: seo(
      "Product Discovery",
      "Validate the problem, users, journeys and scope of a new product before major engineering investment.",
    ),
    audience:
      "Product and digital leaders planning a new product or substantial redesign whose problem, users or scope are not yet validated.",
    trigger: "New product uncertainty: the idea is promising but unproven.",
    scope:
      "Experience and Consulting research the problem and users, map journeys, shape scope and set the prototype direction, so engineering starts from evidence rather than assumptions.",
    outputs: [
      "Validated problem and users",
      "Key journeys",
      "Scope and prototype direction",
      "Delivery backlog",
    ],
    requirements: [sponsorAndOwner, "Access to prospective or current users for research"],
    durationCategory: "short",
    exclusions: ["Building the product, which follows as a Custom Digital Product"],
    nextStep: "Custom Digital Product.",
    solutions: ["digital-product-transformation"],
    practices: ["experience", "consulting"],
    cta: cta("Discuss a product discovery", "offer"),
    provenance: drafted(
      [
        catalogue,
        cite(3, "7.2 Initial Experience offers"),
        pricingCitation,
        cite(3, "13.2 Example account expansion paths"),
      ],
      "Title not in locked copy: Product Discovery is in the Stage 3 and Stage 4 catalogues but not in the Stage 8 §12 initial offer set. The owner decides whether it is published.",
    ),
  },
];

/**
 * Terms every engagement shares (Stage 4 "Scope, Change Control & Acceptance" and "Third-Party
 * Costs, Cloud & Partner Services"). Appended where an offer lists fewer than three, so each page
 * states what the client provides and what is excluded (direction: content research brief §4, kept privately).
 */
const commonRequirements = [
  "Timely decisions and feedback, including acceptance reviews within the agreed window",
  "Agreement on who owns access, data, security and approvals in scope",
];
const commonExclusions = [
  "Changes beyond the agreed scope, which go through change control rather than being absorbed silently",
  "Third-party licences, cloud and AI usage, which are kept separate and visible",
];
const sharedTerms = [
  cite(4, "Scope, Change Control & Acceptance"),
  cite(4, "Third-Party Costs, Cloud & Partner Services"),
];

const overlaps = (list: readonly string[], item: string) => {
  const key = item.split(" ").slice(0, 2).join(" ").toLowerCase();
  return list.some((entry) => entry.toLowerCase().includes(key));
};
const padTo3 = (list: readonly string[], extra: readonly string[]): string[] => {
  const out = [...list];
  for (const item of extra) {
    if (out.length >= 3) break;
    if (
      !overlaps(out, item) &&
      !(item.startsWith("Third-party") && out.some((e) => /licen/i.test(e)))
    ) {
      out.push(item);
    }
  }
  return out;
};

export const offerDrafts: readonly OfferDraft[] = offers.map((offer) => ({
  ...offer,
  requirements: padTo3(offer.requirements, commonRequirements),
  exclusions: padTo3(offer.exclusions, commonExclusions),
  provenance: { ...offer.provenance, sources: [...offer.provenance.sources, ...sharedTerms] },
}));
