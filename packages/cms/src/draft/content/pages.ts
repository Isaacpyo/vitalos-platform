/**
 * Site settings, the homepage and the route pages (index pages). Locked strings are imported from
 * locked-copy.ts, never repeated. Most headings are quoted from the Stage 11 mockup briefs; three
 * index headings are adapted from Stage 11 section titles or composed from the cited sections
 * (marked where they are defined). All are pending owner confirmation like everything else here.
 */
import { brandName, ctas, homeSections, howWeWorkStages, propositionLong } from "../../locked-copy";
import type { HomeSectionKey } from "../../locked-copy";
import type {
  ContactPageView,
  RoutePageView,
  SiteSettingsView,
  TrustOverviewView,
} from "../../content/types";
import type { RoutePageKey } from "../../routes";
import { cta, h2, p, pLink, richText, seo, ul } from "../build";
import { cite, drafted } from "../provenance";
import type { DraftProvenance } from "../provenance";

/* ---------- Site settings ---------- */

/**
 * Only facts the specs state: the brand name and proposition as default SEO. Legal name, company
 * number, registered address, contact and security email, social links and logo are not supplied.
 */
export const settingsDraft: { view: SiteSettingsView; provenance: DraftProvenance } = {
  view: { defaultSeo: { title: brandName, description: propositionLong } },
  provenance: drafted(
    [cite(0, "0. AUTHORITATIVE VITALOS CONTEXT"), cite(7, "7. Messaging hierarchy")],
    "Legal name, company number, registered address, contact and security emails, social links and logo: the specs do not state them (Stage 6 §4.1 lists them as owner-supplied).",
  ),
};

/* ---------- Homepage headings ---------- */

/** A spec-quoted heading from locked copy, where one exists for the section. */
function lockedHeading(key: HomeSectionKey): string | undefined {
  const section = homeSections.find((entry) => entry.key === key);
  return section && "visibleHeading" in section ? section.visibleHeading : undefined;
}

function headingFor(key: HomeSectionKey): string {
  const heading = lockedHeading(key);
  if (heading === undefined) throw new Error(`No locked heading for ${key}`);
  return heading;
}

/**
 * Section headings. Five are the spec-quoted titles in locked copy. The others are the section
 * names Stage 11 §9 uses for items 7, 9 and 10 ("Industries", "Vitalos Labs", "Insights"); its
 * Trust and Leadership bands were removed from the homepage (owner direction, 15 Oct 2026). The
 * hero is locked copy and has no heading entry; the credibility strip has no quoted title and no
 * verified proof, so it has none either.
 */
export const homeHeadings: Partial<Record<HomeSectionKey, string>> = {
  problems: headingFor("problems"),
  strategyToProduction: headingFor("strategyToProduction"),
  practices: headingFor("practices"),
  selectedWork: headingFor("selectedWork"),
  industries: "Industries",
  labs: "Vitalos Labs",
  insights: "Insights",
  finalConversion: headingFor("finalConversion"),
};

export const homeProvenance = drafted(
  [
    cite(8, "8. Homepage architecture"),
    cite(11, "9. Homepage — desktop high-fidelity mockup"),
    cite(10, "14. Homepage production plan"),
  ],
  "Credibility strip, Selected Work and Insights are empty: no verified proof, case studies or named authors exist (Stage 8 §8; Stage 10 §14). The invented placeholder personas, articles, scenarios and role (ADR-025 status note, 11 October 2026) are deliberately not featured on the home page.",
);

/* ---------- Route pages ---------- */

export interface RoutePageDraft {
  view: RoutePageView | ContactPageView | TrustOverviewView;
  provenance: DraftProvenance;
}

const howWeWorkStageText: Readonly<Record<(typeof howWeWorkStages)[number], string>> = {
  Qualify:
    "Should Vitalos pursue this work? We weigh the problem, sponsor, urgency, budget, complexity and risk, then pursue, clarify or decline.",
  Discover:
    "What is actually happening and why? We gather evidence on users, processes, systems, data, risks and success measures before large commitments.",
  Define:
    "What exactly should be done? Scope, outcomes, architecture, roadmap, backlog and acceptance, clear on what is included and excluded.",
  Design:
    "How will the solution work? Service, interface, technical, integration, data and security design, with material choices in decision records.",
  Engineer:
    "Can we build it safely and incrementally? Working increments with version control, peer review, automated checks and controlled environments, to Vitalos standards.",
  Validate:
    "Is it fit for release and use? Functional, security, performance, accessibility, data and readiness checks, AI evaluation where relevant, and named client acceptance.",
  Release:
    "Can we move to production safely? Deployment, migration, runbooks, monitoring, rollback and training. A deadline is never approval to skip review, validation or rollback planning.",
  Operate:
    "Can the live service meet its commitments? Monitoring, incident response, support, maintenance and reporting, with ownership made explicit at service transition.",
  Improve:
    "What should change next? We review outcomes, incidents, cost, user friction and technical debt, and agree the next roadmap.",
};

const howWeWork: RoutePageDraft = {
  view: {
    key: "how-we-work",
    heading: "Disciplined delivery without unnecessary bureaucracy.",
    intro:
      "Start with consulting or come straight to engineering. Every engagement follows one delivery lifecycle, with quality gates never waived to protect a date.",
    body: richText(
      "route-how-we-work",
      h2("Two ways to start"),
      p(
        "Consulting-led: when the problem is known but the solution is not, discovery and assessment create the evidence and roadmap. Engineering-led: when the objective, requirements and constraints are clear, we confirm the approach and build.",
      ),
      h2("One accountable Engagement Lead"),
      p(
        "Every engagement has one named Engagement Lead, accountable for the relationship, outcome, delivery, commercial health, risk, quality and truthful reporting. You never coordinate separate Vitalos practices yourself.",
      ),
      h2("Quality gates"),
      p(
        "Before production or acceptance, work passes gates for architecture, security, privacy, data, quality, performance, accessibility, resilience, readiness, documentation and client acceptance, plus AI evaluation where relevant. A gate that does not apply is recorded as not applicable, with the reason.",
      ),
      h2("Contractors under Vitalos standards"),
      p(
        "Contractors and partners may add capacity, but you contract with Vitalos, which stays accountable, and you know the responsibility model. They follow Vitalos standards with least-privilege access, removed promptly, and critical knowledge never stays with one contractor.",
      ),
      h2("What clients can expect"),
      p(
        "Organised without bureaucracy, technically serious but accessible, commercially disciplined but not adversarial, fast but not reckless. Status reports say what is true, and scope changes are handled openly, never absorbed silently.",
      ),
      ...howWeWorkStages.flatMap((stage) => [h2(stage), p(howWeWorkStageText[stage])]),
    ),
    cta: cta(ctas.primary, "project"),
    seo: seo(
      "How We Work",
      "One delivery lifecycle from Qualify to Improve, with an accountable Engagement Lead and mandatory quality gates.",
    ),
  },
  provenance: drafted([
    cite(5, "3. Vitalos Delivery Lifecycle"),
    cite(5, "4. Qualify, Discover & Define"),
    cite(5, "5. Design & Engineer"),
    cite(5, "6. Validate & Release"),
    cite(5, "7. Operate & Improve"),
    cite(5, "8. Delivery entry paths"),
    cite(5, "9.1 The Engagement Lead"),
    cite(5, "11. Mandatory quality gates"),
    cite(5, "Non-negotiable contractor model"),
    cite(5, "Desired client experience"),
    cite(5, "Baseline weekly status"),
    cite(5, "15. Scope, change control & commercial health"),
    cite(8, "17. About, Leadership & How We Work"),
    cite(11, "28. How We Work"),
  ]),
};

const whatWeDo: RoutePageDraft = {
  view: {
    key: "what-we-do",
    heading: "Strategy, engineering and AI — connected through delivery.",
    intro:
      "Vitalos combines consulting with hands-on engineering, from problem definition through production and ongoing improvement.",
    body: richText(
      "route-what-we-do",
      h2("Three ways to look at what we do"),
      ul(
        "Practices are our capabilities.",
        "Solutions are problems we solve across practices.",
        "Offers are bounded, practical ways to start.",
      ),
      p(
        "Complex problems often need more than one practice. You still work with one integrated team and one accountable engagement lead.",
      ),
    ),
    cta: cta(ctas.primary, "general"),
    seo: seo(
      "What We Do",
      "Practices, solutions and offers: how Vitalos connects consulting, engineering and AI from strategy to production.",
    ),
  },
  provenance: drafted([
    cite(3, "2. The Three-Layer Service Architecture"),
    cite(3, "9.1 Solution ownership"),
    cite(8, "9. What We Do — commercial architecture"),
    cite(11, "13. What We Do index page"),
  ]),
};

const solutions: RoutePageDraft = {
  view: {
    key: "solutions",
    // Adapted from the Stage 11 §13 section title "Solutions — the problems we solve".
    heading: "Solutions: the problems we solve.",
    intro:
      "Solutions are organised around problems executives recognise. Each brings together the practices the outcome needs, under one accountable engagement lead.",
    cta: cta(ctas.primary, "project"),
    seo: seo(
      "Solutions",
      "Cross-practice solutions organised around the business and technology problems leaders recognise.",
    ),
  },
  provenance: drafted([
    cite(8, "11. Solutions architecture"),
    cite(3, "9. Cross-Practice Solution Plays"),
    cite(3, "9.1 Solution ownership"),
    cite(11, "13. What We Do index page"),
  ]),
};

const offers: RoutePageDraft = {
  view: {
    key: "offers",
    // Adapted from the Stage 11 §13 section title "Offers — practical ways to start".
    heading: "Offers: practical ways to start.",
    intro:
      "Offers are bounded engagements, not discount packages. Each sets out the work, what you get and what we need; pricing comes in a proposal once scope is understood.",
    cta: cta(ctas.primary, "offer"),
    seo: seo(
      "Offers",
      "Bounded engagements to start with: assessments, discoveries, sprints, delivery and managed services. Pricing is proposal-led.",
    ),
  },
  provenance: drafted([
    cite(8, "12. Offer architecture"),
    cite(3, "10. Initial Offer Catalogue"),
    cite(11, "13. What We Do index page"),
  ]),
};

const industries: RoutePageDraft = {
  view: {
    key: "industries",
    // Composed from Stage 2 §5 and Stage 8 §13; no spec quotes an Industries index heading.
    heading: "Three launch sectors, and selective work with technology companies.",
    intro:
      "We start with three sectors where we are building repeatable domain knowledge, and work selectively with growth and technology companies.",
    cta: cta(ctas.primary, "project"),
    seo: seo(
      "Industries",
      "Health & Care; Retail, Commerce & Consumer; Operations, Industry & Logistics; and selective Growth & Technology work.",
    ),
  },
  provenance: drafted([
    cite(2, "5. Initial Industry Verticals"),
    cite(8, "13. Industry architecture"),
  ]),
};

const work: RoutePageDraft = {
  view: {
    key: "work",
    heading: "Technology outcomes, not project theatre.",
    intro:
      "Case studies of client work, published only with permission and evidence. Each says whether the work was contracted by Vitalos or reflects prior team experience.",
    seo: seo("Work", "Case studies of client work, published with permission and evidence."),
  },
  provenance: drafted(
    [cite(11, "19. Work index"), cite(10, "17. Work / case-study launch")],
    "No verified case studies exist (Stage 10 §17). The Work section opens in the draft source only because of the two placeholder scenarios (ADR-025 status note, 11 October 2026); this page is noindex while they are its only content.",
  ),
};

const insights: RoutePageDraft = {
  view: {
    key: "insights",
    heading: "Ideas for turning technology into operating advantage.",
    intro:
      "Executive briefings, engineering notes, research and guides for business and technology leaders, each with a named author.",
    seo: seo(
      "Insights",
      "Executive briefings, engineering notes, research and guides from named Vitalos authors.",
    ),
  },
  provenance: drafted(
    [cite(11, "21. Insights index"), cite(8, "16. Insights & authority platform")],
    "The specs name no author (Stage 8 §16; Stage 10 §18). The Insights section opens in the draft source only because of the six placeholder articles by invented personas (ADR-025 status note, 11 October 2026); this page is noindex while they are its only content.",
  ),
};

const labs: RoutePageDraft = {
  view: {
    key: "labs",
    heading: "Research, prototypes and engineering accelerators.",
    intro:
      "Vitalos Labs explores emerging technology, builds reference architectures and tests ideas before they become client capabilities or products. Labs is technical proof, not client work.",
    body: richText(
      "route-labs",
      h2("Maturity labels"),
      p("Every Labs asset carries a maturity label, shown above the fold, that says what exists:"),
      ul(
        "Research: exploration or analysis; not a client product.",
        "Concept: a defined idea with limited implementation evidence.",
        "Prototype: a working proof designed to test feasibility.",
        "Accelerator: a reusable internal or client delivery component.",
        "Beta / Pilot: limited use with explicit constraints.",
        "Production product: only when a separately supported commercial product genuinely exists.",
      ),
      p("Each asset states what it is, what it is not and its known limitations."),
    ),
    seo: seo(
      "Vitalos Labs",
      "Research, concepts, prototypes and accelerators from Vitalos Labs, each with an explicit maturity label.",
    ),
  },
  provenance: drafted([
    cite(11, "23. Vitalos Labs index"),
    cite(8, "15. Vitalos Labs digital architecture"),
    cite(19, "4. Maturity labels"),
    cite(19, "37. Labs website and proof architecture"),
  ]),
};

const about: RoutePageDraft = {
  view: {
    key: "about",
    heading: "Strategy and engineering, connected by responsibility for the outcome.",
    intro:
      "Vitalos is a technology consulting, engineering and digital transformation company with AI at the centre.",
    body: richText(
      "route-about",
      h2("Why Vitalos exists"),
      p(
        "Technology now shapes how organisations operate, serve customers and compete, and AI accelerates the shift. Vitalos exists for the hard part: redesigning work, modernising systems, connecting data and carrying change safely into production.",
      ),
      h2("From strategy to production"),
      p(
        "We help organisations decide what to change and where technology and AI create real value, then build it and keep improving it. That is why Vitalos is neither a strategy-only consultancy nor a build-to-spec agency.",
      ),
      h2("Five practices, one firm"),
      p(
        "Our five practices share one delivery lifecycle, one accountability model and one quality philosophy. One engagement never feels like five departments.",
      ),
      h2("Two ways to start"),
      p(
        "Clients can start with consulting or come directly for engineering. Discovery is used when it reduces real uncertainty or risk, not by default.",
      ),
      h2("Operating principles"),
      ul(
        "Senior involvement: people who understand the problem and can decide.",
        "Evidence before claims: facts over adjectives.",
        "Production quality: security, reliability, maintainability and readiness built in.",
        "Responsible AI: used where value is measurable and governable.",
        "Commercially sensible: scope, assumptions, responsibilities, risks and outcomes made explicit.",
      ),
      h2("UK first, international by design"),
      p(
        "The United Kingdom is our launch market and commercial base. Our services and standards are designed for international work as it grows, without pretending geographic scale already exists.",
      ),
    ),
    cta: cta(ctas.primary, "general"),
    seo: seo(
      "About Vitalos",
      "A technology consulting, engineering and digital transformation company with AI at the centre, from strategy to production.",
    ),
  },
  provenance: drafted(
    [
      cite(7, "9. Brand narrative"),
      cite(7, "10. Messaging pillars"),
      cite(2, "10. Differentiation Strategy"),
      cite(2, "3.1 Primary Launch Market — United Kingdom"),
      cite(5, "1. Executive summary"),
      cite(3, "15.2 Cross-practice operating rule"),
      cite(8, "17. About, Leadership & How We Work"),
      cite(11, "26. About Vitalos"),
    ],
    "No leadership preview: no leadership profile exists. No locations, staff numbers or client names (Stage 11 §38).",
  ),
};

const trust: RoutePageDraft = {
  view: {
    key: "trust",
    heading: "Trust should be verifiable.",
    intro:
      "Vitalos publishes how it approaches security, privacy, Responsible AI, accessibility and delivery assurance, and provides controlled evidence for procurement where appropriate.",
    body: richText(
      "route-trust",
      p(
        "Each topic shows its public summary. Only verified certifications will ever be listed. Procurement and security questions go through the procurement route; controlled documents are shared where they exist.",
      ),
    ),
    cta: cta("Ask a procurement question", "procurement"),
    seo: seo(
      "Trust Centre",
      "How Vitalos approaches security, privacy, Responsible AI, accessibility, resilience and procurement.",
    ),
    topics: [],
  },
  provenance: drafted([
    cite(11, "25. Trust Centre"),
    cite(8, "18. Trust Centre architecture"),
    cite(6, "14. Vitalos Trust Centre"),
  ]),
};

const careers: RoutePageDraft = {
  view: {
    key: "careers",
    heading: "Careers",
    intro: "Open roles are published here when Vitalos is hiring.",
    seo: seo("Careers", "Open roles at Vitalos."),
  },
  provenance: drafted(
    [cite(8, "19. Careers architecture")],
    "There are no open roles, and Stage 8 §19 rules out a dead careers page. Careers opens in the draft source only because of one placeholder role (ADR-025 status note, 11 October 2026); this page is noindex while it is the only content. Culture, benefits and working-practice copy need real facts from the owner.",
  ),
};

const contact: RoutePageDraft = {
  view: {
    key: "contact",
    heading: headingFor("finalConversion"),
    intro:
      "Come to us for consulting, direct engineering, AI and data work or managed services. Tell us what you are trying to achieve and we will help identify the right starting point.",
    expectations: richText(
      "route-contact-expectations",
      p(
        "We read every enquiry and reply to arrange a conversation about the right starting point. There is no obligation, and you do not need to complete a procurement questionnaire first.",
      ),
      pLink(
        "We use your details to respond to and qualify your enquiry, as described on the ",
        "privacy page",
        "/legal/privacy",
        ".",
      ),
    ),
    successMessage:
      "Thank you. Your enquiry has been received and we will be in touch about next steps.",
    routes: [
      {
        intent: "project",
        label: "Discuss a business or technology problem",
        description: "A project enquiry: tell us the problem and we will suggest a starting point.",
      },
      {
        intent: "offer",
        label: "Start a defined assessment",
        description: "An enquiry about a specific offer, such as a Technology Health Assessment.",
      },
      {
        intent: "engineering",
        label: "An engineering requirement",
        description:
          "A defined build, integration or modernisation that can go straight to engineering.",
      },
      {
        intent: "ai",
        label: "An AI opportunity",
        description: "From an AI Opportunity Assessment to production AI.",
      },
      {
        intent: "managed-services",
        label: "Ongoing support or a system takeover",
        description: "Managed services for systems we build or responsibly take over.",
      },
      {
        intent: "procurement",
        label: "Procurement and security",
        description: "Questionnaires, supplier onboarding and requests for controlled documents.",
      },
      { intent: "partnership", label: "Partnership", description: "A partner enquiry." },
      { intent: "careers", label: "Careers", description: "Roles and talent contact." },
      { intent: "general", label: "General and media", description: "Anything else." },
    ],
    seo: seo(
      ctas.primary,
      "Start a conversation with Vitalos about consulting, engineering, AI and data or managed services.",
    ),
  },
  provenance: drafted(
    [
      cite(11, "29. Contact / Talk to Vitalos"),
      cite(8, "20. Contact & conversion architecture"),
      cite(10, "21. Lead capture & enquiry architecture"),
    ],
    "No response-time promise: Stage 8 §20 and Stage 10 §21 allow one only when it can be met operationally, and none is confirmed.",
  ),
};

/** Route pages. */
export const routePageDrafts: Partial<Record<RoutePageKey, RoutePageDraft>> = {
  "what-we-do": whatWeDo,
  solutions,
  offers,
  industries,
  work,
  insights,
  labs,
  about,
  "how-we-work": howWeWork,
  trust,
  careers,
  contact,
};
