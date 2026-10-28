import { routes } from "@vitalos/cms";
import { aiDataOfferLabels } from "@vitalos/validation/ai-data-enquiry";
import type { AiDataOffer } from "@vitalos/validation/ai-data-enquiry";

/**
 * Copy for the Vitalos AI & Data section (docs/ai-data/PLAN.md, blueprint sections 3, 5, 7.3, 8
 * and 18). Plain English, measured and outcome-led. Rules this file keeps:
 *
 * - No prices (AID-006): fees are fixed and agreed in writing before work starts.
 * - No case studies, testimonials, client logos, ROI figures, certifications, partnerships or
 *   product availability: none exist yet, and nothing here implies they do.
 * - Data and security practices are described as how we work, never as certifications.
 * - "Forward-deployed engineering" appears only as an explained footnote (blueprint 3.3).
 */

export const division = {
  name: "Vitalos AI & Data",
  qualifier: "AI & Data",
  category: "Applied AI & Data Engineering",
  primaryCta: "Discuss Your Business Challenge",
  headerCta: "Discuss your challenge",
} as const;

export const navItems = [
  { label: "Solutions", href: routes.aiData.solutions() },
  { label: "Our Approach", href: routes.aiData.approach() },
  { label: "Demonstrator", href: routes.aiData.demonstrator() },
] as const;

export const hero = {
  eyebrow: "Applied AI & Data Engineering",
  title: "From AI potential to production reality.",
  lead: "We work alongside your team to design, engineer and operate intelligent systems that solve real business problems.",
} as const;

/** Plain-English outcomes (blueprint 5.6). Statements of intent, not measured results. */
export const outcomes = [
  {
    title: "Less manual re-keying",
    text: "Reduce the time spent copying figures from documents into your systems by hand.",
  },
  {
    title: "Supplier statements reconciled faster",
    text: "Match statements to your ledger and see the exceptions, instead of ticking lines off one by one.",
  },
  {
    title: "Fewer missed enquiries",
    text: "Capture enquiries from every channel and make sure each one gets a timely follow-up.",
  },
  {
    title: "Reporting you can trust",
    text: "Bring scattered spreadsheets and systems together into reports with clear definitions.",
  },
  {
    title: "Faster quotations",
    text: "Draft quotes and proposals from your own pricing and past work, with a person approving each one.",
  },
] as const;

export interface ServiceArea {
  id: "ai-engineering" | "data-intelligence" | "managed-ai-systems";
  title: string;
  summary: string;
  points: readonly string[];
}

/** The three capability areas (blueprint 18.4). Anchors are stable: other pages link to them. */
export const serviceAreas: readonly ServiceArea[] = [
  {
    id: "ai-engineering",
    title: "AI Engineering",
    summary: "Customer-specific intelligent software and integrations.",
    points: [
      "Document reading and extraction with checks against the source",
      "Workflow software that connects the tools you already use",
      "Assistants that draft for a person to review, not to send on their own",
    ],
  },
  {
    id: "data-intelligence",
    title: "Data Intelligence",
    summary: "Data pipelines, analytics, forecasting and reporting.",
    points: [
      "Pipelines that bring scattered data into one place, on a schedule",
      "Agreed definitions for the figures your reports depend on",
      "Forecasts and analysis with their assumptions written down",
    ],
  },
  {
    id: "managed-ai-systems",
    title: "Managed AI Systems",
    summary: "Monitoring, security, evaluation, maintenance and optimisation.",
    points: [
      "Monitoring of quality, cost and failures once a system is live",
      "Regular re-evaluation when data, models or your process change",
      "Maintenance and improvement within agreed service terms",
    ],
  },
];

export interface Offer {
  key: AiDataOffer;
  title: string;
  /** One line for the home page. */
  short: string;
  purpose: string;
  youGet: readonly string[];
  /** What the offer is not: the honest boundary. */
  isNot: string;
}

/** The four standard offers (blueprint 7.3), without prices (AID-006). */
export const offers: readonly Offer[] = [
  {
    key: "ai-opportunity-assessment",
    title: aiDataOfferLabels["ai-opportunity-assessment"],
    short: "Decide whether one workflow is worth improving, and how.",
    purpose:
      "Find out whether and how one specific workflow can be improved, before you spend on building anything.",
    youGet: [
      "A clear problem definition and a map of how the work is done today",
      "A value estimate based on your own volumes and time",
      "A feasibility view, including the data and security questions to answer",
      "A recommended next step, which may be not to use AI at all",
    ],
    isNot: "Not a sales pitch for a build. Sometimes the right answer is ordinary software.",
  },
  {
    key: "ai-proof-of-value",
    title: aiDataOfferLabels["ai-proof-of-value"],
    short: "Test the critical part of a workflow on your own data.",
    purpose:
      "Test the part of the workflow that matters most, on data you authorise, against success measures agreed at the start.",
    youGet: [
      "A working, bounded demonstration",
      "An evaluation report against the agreed measures",
      "The technical risks and an estimate of running costs",
      "A recommendation on whether and how to go to production",
    ],
    isNot: "Not production-ready software. It answers whether the approach works.",
  },
  {
    key: "production-ai-engineering",
    title: aiDataOfferLabels["production-ai-engineering"],
    short: "Build an approved workflow into your real environment.",
    purpose:
      "Implement an approved workflow in your real operating environment, with the controls it needs.",
    youGet: [
      "An integrated application or service, with sign-in and access controls",
      "Evaluation evidence before launch",
      "Deployment and rollback procedures",
      "Monitoring and a documented handover",
    ],
    isNot:
      "Not a fit for every workflow: if the benefit is small, we will say so before proposing a build.",
  },
  {
    key: "managed-ai-operations",
    title: aiDataOfferLabels["managed-ai-operations"],
    short: "Keep a live system monitored, maintained and improving.",
    purpose: "Operate, monitor, maintain and improve a system once it is live.",
    youGet: [
      "Defined support coverage and incident procedures",
      "Regular reporting on quality, usage and cost",
      "Agreed maintenance and bounded improvement work",
    ],
    isNot:
      "Not unlimited support, and not round-the-clock cover unless that is separately agreed and staffed.",
  },
];

export const feesNote =
  "Fees are fixed for each piece of work and agreed in writing before any work starts.";

export interface Solution {
  id: string;
  title: string;
  problem: string;
  build: string;
  control: string;
  note?: string;
}

/** Concrete SME problems (blueprint 5.5, 5.6; AID-007 first focus). */
export const solutions: readonly Solution[] = [
  {
    id: "documents-and-reconciliation",
    title: "Document processing and statement reconciliation",
    note: "Our first focus: bookkeeping and accounting practices.",
    problem:
      "Supplier statements, invoices and receipts arrive as PDFs and exports. Someone re-keys the figures and ticks lines off against the ledger, month after month.",
    build:
      "Software that reads the documents, checks every figure against its source line, reconciles against your ledger with exact arithmetic and lists the exceptions: missing invoices, amount differences and duplicates.",
    control:
      "Exceptions and anything uncertain go to a person to accept, correct or reject. Nothing is posted to your accounts automatically.",
  },
  {
    id: "enquiry-capture",
    title: "Enquiry capture and follow-up",
    problem:
      "Enquiries arrive by email, web form and phone message. Some are answered late, some not at all, and nobody can see which.",
    build:
      "One place where every enquiry is recorded, sorted by what it needs, and given a follow-up date, with drafts of replies for your team to edit.",
    control:
      "Your team decides what is sent and to whom. Drafts are suggestions; no message goes out on its own.",
  },
  {
    id: "reporting",
    title: "Reporting from fragmented data",
    problem:
      "The numbers live in several spreadsheets and systems. Each report takes hours to assemble and the totals do not always agree.",
    build:
      "Pipelines that collect the data on a schedule, agreed definitions for each figure, and reports that show where every number came from.",
    control:
      "You agree the definitions. When a source is late or looks wrong, the report says so instead of guessing.",
  },
  {
    id: "quotations",
    title: "Quotation and proposal drafting",
    problem:
      "Quotes are built by hand from price lists and old documents, so they are slow to send and vary from person to person.",
    build:
      "A drafting tool that assembles quotes and proposals from your own pricing rules and approved wording.",
    control:
      "Prices are calculated by ordinary code from your rules, not by a model. A person reviews and approves every quote before it is sent.",
  },
  {
    id: "internal-knowledge",
    title: "Making internal knowledge easier to use safely",
    problem:
      "Answers sit in policies, manuals and shared drives. People ask the same questions or rely on whoever remembers.",
    build:
      "Search and question answering over the documents you choose, with every answer citing the passage it came from.",
    control:
      "Access follows your existing permissions. When the documents do not answer a question, the tool says so.",
  },
];

/** The ten lifecycle stages (blueprint 8.1), in plain English. */
export const lifecycle = [
  {
    title: "Understand the problem",
    text: "We look at how the work is done today, with the people who do it.",
  },
  {
    title: "Measure the baseline",
    text: "Time, volume, errors and cost now, so improvement can be shown later.",
  },
  {
    title: "Assess value and risk",
    text: "Whether the gain is worth it, what could go wrong, and whether AI is needed at all.",
  },
  {
    title: "Agree scope",
    text: "What will be built, how it will be judged, the data terms and the fixed fee, in writing.",
  },
  {
    title: "Design",
    text: "The architecture, the integrations and the plan for testing quality.",
  },
  {
    title: "Build",
    text: "A bounded workflow with human review where it matters, and automated tests.",
  },
  {
    title: "Evaluate",
    text: "Against representative and awkward cases, and with your team, before launch.",
  },
  {
    title: "Deploy",
    text: "A controlled release with monitoring and a tested way to roll back.",
  },
  {
    title: "Operate",
    text: "Maintenance, incident handling and reporting under agreed terms.",
  },
  {
    title: "Learn",
    text: "What worked, what it cost, and what should change next.",
  },
] as const;

/** The short loop drawn on the home page and the approach page. */
export const deliveryLoop = [
  "Discover",
  "Diagnose",
  "Build",
  "Evaluate",
  "Deploy",
  "Operate",
  "Improve",
] as const;

/** The four engineering questions (blueprint 8.4), reworded for a business reader. */
export const engineeringQuestions = [
  {
    question: "What business outcome are we improving?",
    text: "Every piece of work starts from a measurable result for your business, not from a technology.",
  },
  {
    question: "How will we prove the system works?",
    text: "We agree the tests and thresholds before building, and report against them.",
  },
  {
    question: "What happens when the AI is wrong or unavailable?",
    text: "Each design says how mistakes are caught, who reviews them, and how work continues if a model service is down.",
  },
  {
    question: "What, if anything, can be reused?",
    text: "We agree in writing what belongs to you and what general know-how we may reuse. Your data is never part of it.",
  },
] as const;

export const dataPractices = [
  {
    title: "Least privilege",
    text: "We ask only for the access the work needs, for as long as it needs it.",
  },
  {
    title: "Agreed purposes only",
    text: "Your data is used only for the purposes agreed in writing.",
  },
  {
    title: "No training on your data",
    text: "We do not use your data to train models without your explicit permission.",
  },
  {
    title: "Clear deletion",
    text: "At the end of the work we delete or return your data as agreed, and confirm it.",
  },
] as const;

export const willNot = [
  "Promise unlimited support, or round-the-clock cover we do not staff.",
  "Let AI take financial or destructive actions on its own: payments, postings and deletions need a person.",
  "Use AI for its own sake. If ordinary software does the job better, we build that.",
  "Claim results, certifications or clients we do not have.",
] as const;

export const audience = {
  title: "Who we work with",
  points: [
    "UK small and medium-sized businesses, roughly 2 to 100 people.",
    "An owner or manager who can approve a scoped piece of work.",
    "A repetitive, costly workflow and access to the data behind it.",
  ],
  deterministic:
    "We use plain, deterministic software whenever AI does not materially help: rules, arithmetic and integrations are often the better answer.",
} as const;
