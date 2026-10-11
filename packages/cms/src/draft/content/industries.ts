/**
 * Industry pages (Stage 2 §5; Stage 8 §13; Stage 10 §16; Stage 13 §22). Names are locked copy
 * (`industryNames`). Sector statements are limited to what the strategy documents say: no clients,
 * accreditations or sector outcomes are claimed.
 */
import { industryNames } from "../../locked-copy";
import type { IndustryView } from "../../content/types";
import { cta, seo } from "../build";
import { cite, drafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import type { IndustrySlug, OfferSlug, SolutionSlug } from "../slugs";

export interface IndustryDraft extends Omit<
  IndustryView,
  "id" | "solutions" | "offers" | "work" | "insights"
> {
  slug: IndustrySlug;
  solutions: readonly SolutionSlug[];
  offers: readonly OfferSlug[];
  provenance: DraftProvenance;
}

const [healthTitle, retailTitle, operationsTitle, growthTitle] = industryNames;

const verticals = cite(2, "5. Initial Industry Verticals");
const architecture = cite(8, "13. Industry architecture");
const production = cite(10, "16. Industry production");
const reputation = cite(13, "22. Industry reputation architecture");

export const industryDrafts: readonly IndustryDraft[] = [
  {
    slug: "health-care",
    title: healthTitle,
    summary:
      "Technology that improves care, operations and access, for healthcare providers, care organisations, health and care technology and related operational services.",
    seo: seo(
      "Health & Care",
      "Modernising care operations, digital services, data and AI while managing privacy, accessibility, safety and trust.",
    ),
    realities: [
      "Care operations run on workflows, scheduling, and records and data flows that shape how staff spend their time.",
      "Patient and service-user experience depends on digital services that are accessible and easy to use.",
      "Privacy, security, accessibility, safety and trust have to be managed alongside any change to technology or process.",
      "Reporting and digital service delivery depend on data that is often spread across several systems.",
    ],
    problems: [
      "Modernising operational workflows and scheduling.",
      "Digital products and portals for patients, service users and staff.",
      "Integrating records and data flows between systems.",
      "Reliable reporting and operational intelligence.",
      "Reducing administrative effort for staff through automation.",
    ],
    aiOpportunities: [
      "Compliance-aware AI in administrative and operational workflows, with human oversight wherever decisions affect people.",
      "Automation that reduces manual effort for staff, using deterministic workflows first and AI where it adds measurable value.",
      "Reporting and operational intelligence built on data with clear ownership and quality checks.",
    ],
    considerations: [
      "Work that touches clinical decisions or regulated compliance needs specialist clinical, legal or accredited assurance alongside technology delivery.",
      "Organisations with access to NHS patient data and systems use the NHS Data Security and Protection Toolkit to demonstrate their data security.",
      "UK procurement guidance requires Cyber Essentials, Cyber Essentials Plus or demonstrably equivalent controls for certain higher-risk NHS and central government contracts.",
      "Personal and sensitive data needs deliberate decisions about purpose, access, retention and deletion.",
      "Digital services must be accessible to patients, service users and staff.",
    ],
    solutions: [
      "business-process-modernisation",
      "digital-product-transformation",
      "data-intelligence-transformation",
      "ai-transformation",
    ],
    offers: [
      "digital-transformation-discovery",
      "ai-opportunity-assessment",
      "systems-integration",
      "business-process-automation",
    ],
    cta: cta("Discuss a health & care challenge", "project"),
    provenance: drafted(
      [
        verticals,
        cite(2, "Health & Care"),
        architecture,
        production,
        reputation,
        cite(6, "11. Health & public-sector readiness"),
        cite(3, "16.2 Early boundary examples"),
        cite(5, "14.3 Privacy-by-design"),
        cite(11, "18. Industry template"),
      ],
      "No sector clients, accreditations or outcomes: none are evidenced (Stage 10 §16). The DSPT and Cyber Essentials considerations are UK reference points as at September 2026 (Stage 6 §11); review them before publication.",
    ),
  },
  {
    slug: "retail-commerce-consumer",
    title: retailTitle,
    summary:
      "Commerce platforms, order and inventory integration, customer experience, data and AI-enabled operations for retailers, e-commerce businesses, consumer brands, wholesalers and distributors.",
    seo: seo(
      "Retail, Commerce & Consumer",
      "Commerce platforms, inventory and order integration, customer experience, data and AI-enabled operations.",
    ),
    realities: [
      "Customer experience, merchandising and fulfilment have to work together across online and operational systems.",
      "Inventory, orders and customer data often live in separate platforms that need to stay in step.",
      "Growth depends on commerce platforms that can scale and change without disrupting trading.",
      "Forecasting and decisions depend on analytics that people trust.",
    ],
    problems: [
      "Modernising commerce platforms.",
      "Integrating inventory and order systems.",
      "Improving the customer digital journey.",
      "Automating operational work behind the storefront.",
      "Analytics and forecasting.",
    ],
    aiOpportunities: [
      "AI-enabled customer service connected to order and inventory data.",
      "Forecasting supported by a reliable data foundation.",
      "AI-assisted operations that reduce manual work in fulfilment and service.",
    ],
    considerations: [
      "Customer personal data needs deliberate decisions about purpose, access, retention and deletion.",
      "Commerce experiences must be accessible.",
      "Changes to trading systems need validation, release control and rollback that protect live trading.",
    ],
    solutions: [
      "digital-product-transformation",
      "business-process-modernisation",
      "data-intelligence-transformation",
      "ai-transformation",
    ],
    offers: [
      "customer-experience-transformation",
      "systems-integration",
      "data-bi-modernisation",
      "ai-opportunity-assessment",
    ],
    cta: cta("Discuss a commerce challenge", "project"),
    provenance: drafted(
      [
        verticals,
        cite(2, "Retail, Commerce & Consumer"),
        architecture,
        production,
        reputation,
        cite(3, "7.2 Initial Experience offers"),
        cite(5, "6.2 Release"),
        cite(5, "14.3 Privacy-by-design"),
      ],
      "No sector clients or outcomes: none are evidenced.",
    ),
  },
  {
    slug: "operations-industry-logistics",
    title: operationsTitle,
    summary:
      "Workflow modernisation, integration, operational intelligence and AI-assisted operations for manufacturing, logistics, supply chain, field operations and engineering-intensive businesses.",
    seo: seo(
      "Operations, Industry & Logistics",
      "Process digitisation, integration, field and warehouse tools, operational intelligence and AI-assisted operations.",
    ),
    realities: [
      "Operationally intensive businesses often still run critical processes on manual steps and disconnected tools.",
      "Field, warehouse and fleet data is only useful when it reaches the people planning and running operations.",
      "Ageing operational systems can make processes hard to change.",
      "Reliability matters: operational systems have to keep working while they are improved.",
    ],
    problems: [
      "Digitising manual processes.",
      "Integrating systems across operations.",
      "Operational dashboards and intelligence.",
      "Mobile and field tools.",
      "Replacing legacy operational systems.",
    ],
    aiOpportunities: [
      "AI-assisted operations and decision support on top of integrated operational data.",
      "Forecasting for operational planning.",
      "Asset and process intelligence from field, warehouse and fleet data.",
    ],
    considerations: [
      "Operational systems need resilience, recovery and rollback planning proportionate to their criticality.",
      "Field and mobile tools must work for the people using them in real operating conditions.",
    ],
    solutions: [
      "business-process-modernisation",
      "application-modernisation",
      "data-intelligence-transformation",
      "ai-transformation",
    ],
    offers: [
      "digital-transformation-discovery",
      "systems-integration",
      "business-process-automation",
      "technology-health-assessment",
    ],
    cta: cta("Discuss an operations challenge", "project"),
    provenance: drafted(
      [
        verticals,
        cite(2, "Operations, Industry & Logistics"),
        architecture,
        production,
        reputation,
        cite(5, "12.5 Backup, recovery and rollback"),
      ],
      "No sector clients or outcomes: none are evidenced.",
    ),
  },
  {
    slug: "growth-technology",
    title: growthTitle,
    summary:
      "Selective work with startups, scale-ups and technology businesses: architecture, product engineering, platform modernisation, AI implementation and engineering rescue.",
    seo: seo(
      "Growth & Technology",
      "Architecture, product engineering, platform modernisation, AI implementation and engineering rescue for technology companies.",
    ),
    realities: [
      "A capable internal team may lack specialist capacity for a major build or modernisation.",
      "Products that stalled or became hard to maintain can need rescue before they can grow.",
    ],
    problems: [
      "Product engineering.",
      "Architecture.",
      "Platform modernisation.",
      "AI implementation.",
      "Engineering rescue.",
    ],
    aiOpportunities: [
      "AI implemented inside the product, with evaluation criteria defined before launch.",
    ],
    considerations: [],
    solutions: [
      "digital-product-transformation",
      "technology-recovery-reliability",
      "ai-transformation",
    ],
    offers: ["engineering-rescue", "technology-health-assessment", "ai-prototype-sprint"],
    cta: cta("Discuss a product or platform", "engineering"),
    provenance: drafted(
      [
        cite(2, "5.1 Horizontal Opportunity — Technology & Growth Companies"),
        cite(2, "4.1 Positive Fit Signals"),
        architecture,
        production,
        cite(3, "11.2 AI engagement principles"),
      ],
      "A selective proposition, not a claim of deep sector specialism (Stage 8 §13). No considerations are drafted because the specs state none for this sector.",
    ),
  },
];
