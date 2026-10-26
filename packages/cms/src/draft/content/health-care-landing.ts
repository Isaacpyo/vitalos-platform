/**
 * The Health & Care lead page (Website Build Pack, 25 Oct 2026, Part 2 revision 2). Every word is
 * the owner's, word for word; British English. Points carry substance: an icon, a bold title of up
 * to six words and one supporting line of up to 20 words. Point `key`s name the subject (the
 * brief's Lucide names, as a guide); the web app maps them to the site's own icons.
 *
 * Published: Temitope approved the page on 26 Oct 2026 (ADR-046). Every claim the owner had not
 * confirmed was removed before publication rather than published with its `[confirm]` mark: the
 * Clinical Safety Officer partner, UK hosting, Cyber Essentials, the Fauward healthcare features
 * (its pilot card and driver checks) and the design-partner benefits. Add them back once confirmed.
 */
import { routes } from "../../routes";
import type { CtaView, IndustryLandingView } from "../../content/types";
import { seo } from "../build";

const auditCta: CtaView = {
  label: "Book a clinic admin audit",
  href: routes.contact("healthcare-audit"),
  intent: "healthcare-audit",
};

const partnerCta: CtaView = {
  label: "Become a design partner",
  href: routes.contact("healthcare-partner"),
  intent: "healthcare-partner",
};

export const healthCareLanding: IndustryLandingView = {
  publishStatus: "published",
  seo: seo(
    "Health & Care: consulting for clinics and NHS teams",
    "We help private clinics, GP practices and NHS teams cut admin, connect their systems and get NHS-ready. Fixed-scope engagements that end with something working.",
  ),
  eyebrow: "Health & Care",
  heading: "Give care teams their time back.",
  lead: "We help private clinics, GP practices and NHS teams cut admin, connect their systems and get NHS-ready. Fixed-scope engagements that end with something working.",
  primaryCta: auditCta,
  secondaryCta: { label: "See offers", href: "#offers", intent: "explore" },
  proof: [
    { key: "timer", text: "Two-week audit" },
    { key: "user-check", text: "Human review on every AI output" },
    { key: "badge-check", text: "Built for NHS assurance" },
  ],
  audiences: {
    heading: "Who we work with",
    points: [
      {
        key: "building-2",
        title: "Private clinics and hospitals",
        text: "Busy front desks, insurer billing and consultant letters.",
      },
      {
        key: "stethoscope",
        title: "GP practices and PCNs",
        text: "Document workflow, referrals and coding across one site or many.",
      },
      {
        key: "landmark",
        title: "NHS trusts",
        text: "Integration and assurance work, alongside suppliers already on NHS frameworks.",
      },
      {
        key: "truck",
        title: "Couriers, labs and pharmacies",
        text: "Sample and medicine movements with a record at every handoff.",
      },
      {
        key: "cpu",
        title: "Health-tech suppliers",
        text: "The DTAC, DSPT and clinical safety evidence NHS buyers ask for.",
      },
    ],
  },
  painPoints: {
    heading: "Where the time goes",
    points: [
      {
        key: "inbox",
        title: "Inboxes and referrals pile up",
        text: "Letters, results and referrals arrive by email, post and portal, and each is read, matched and filed by hand.",
      },
      {
        key: "file-text",
        title: "Letters written after hours",
        text: "Clinic letters and GP updates get typed up once the clinic day ends.",
      },
      {
        key: "unplug",
        title: "Systems that don't talk",
        text: "Practice, billing, lab and pharmacy systems need the same details keyed twice.",
      },
      {
        key: "shield-check",
        title: "NHS evidence takes weeks",
        text: "DTAC, DSPT, DPIAs and safety cases are slow to build from nothing.",
      },
      {
        key: "package",
        title: "Samples and medicines on paper",
        text: "Run sheets and signatures can't prove who had what, and when.",
      },
    ],
  },
  offers: {
    heading: "Start with a fixed-scope engagement",
    anchor: "offers",
    points: [
      {
        key: "timer",
        title: "Clinic Admin Audit",
        meta: "Short (2 weeks)",
        text: "Find where admin hours go, and what to automate first.",
        points: [
          { key: "check", text: "Workflow map from arrival to filing" },
          { key: "check", text: "Baseline minutes per document" },
          { key: "check", text: "Ranked automation plan with review points" },
        ],
        note: "Clinics with a backlog, or an AI plan with no starting point",
        href: routes.offer("clinic-admin-audit"),
      },
      {
        key: "plug",
        title: "Systems Integration",
        meta: "Medium",
        text: "Connect practice, billing, inbox and e-signature systems so details are entered once.",
        points: [
          { key: "check", text: "Integrated workflows" },
          { key: "check", text: "Alerts when a sync fails" },
          { key: "check", text: "Runbooks for your team" },
        ],
        note: "Teams re-keying the same data between systems",
        href: routes.offer("systems-integration"),
      },
      {
        key: "badge-check",
        title: "NHS Assurance Readiness",
        meta: "Short",
        text: "Build the evidence NHS buyers ask for, before procurement does.",
        points: [
          { key: "check", text: "DTAC form with evidence" },
          { key: "check", text: "NHS-template DPIA and DSPT submission" },
        ],
        note: "Suppliers with an NHS pilot or tender in view",
        href: routes.offer("nhs-assurance-readiness"),
      },
      {
        key: "truck",
        title: "Medical Logistics Digitisation",
        meta: "Medium",
        text: "Give every sample and medicine movement a record that stands up to audit.",
        points: [
          { key: "check", text: "Your brand on Fauward" },
          { key: "check", text: "Custody and delivery records" },
        ],
        note: "Couriers, labs and pharmacy groups",
        href: routes.offer("medical-logistics-digitisation"),
      },
    ],
  },
  automation: {
    heading: "What we automate",
    points: [
      {
        key: "inbox",
        title: "Inbound documents",
        text: "Read, matched to the patient, summarised and routed with a suggested next step.",
        note: "Reviewed by the admin team.",
      },
      {
        key: "file-pen",
        title: "Clinic letters",
        text: "Drafted from the clinician's notes, ready to edit and sign.",
        note: "Reviewed by the clinician.",
      },
      {
        key: "tags",
        title: "Clinical and billing codes",
        text: "SNOMED CT for NHS work, procedure codes for insurer invoices, suggested, never applied.",
        note: "Reviewed by a coder or clinician.",
      },
      {
        key: "receipt",
        title: "Insurer invoices",
        text: "Prepared from the record with codes attached, ready to check and send.",
        note: "Reviewed by the billing team.",
      },
      {
        key: "route",
        title: "Referral tracking",
        text: "Each referral followed from arrival to booked appointment, with overdue ones flagged.",
        note: "Reviewed by the admin team.",
      },
    ],
  },
  steps: {
    heading: "How an engagement runs",
    points: [
      {
        key: "search",
        title: "Assess",
        meta: "Short (2 weeks)",
        text: "We shadow the team, map each document's path and time the work.",
        note: "A baseline and a ranked plan",
      },
      {
        key: "flask-conical",
        title: "Pilot",
        meta: "Short",
        text: "One workflow, one team, measured against the baseline.",
        note: "Before-and-after figures and a go or no-go",
      },
      {
        key: "rocket",
        title: "Roll out",
        meta: "Medium",
        text: "More workflows, teams and sites, with training and runbooks.",
        note: "A live service your team owns",
      },
      {
        key: "settings",
        title: "Operate",
        meta: "Ongoing",
        text: "We monitor, fix and improve it under Managed Services.",
        note: "Regular service reviews",
      },
    ],
  },
  guardrails: {
    heading: "AI that drafts. People who decide.",
    columns: [
      {
        heading: "What the agents do",
        points: [
          {
            key: "check",
            title: "Read and route",
            text: "Inbound documents matched, summarised and sent to the right person.",
          },
          {
            key: "check",
            title: "Draft",
            text: "Letters and summaries prepared for a clinician to edit.",
          },
          {
            key: "check",
            title: "Suggest",
            text: "Codes and next steps proposed, never applied without approval.",
          },
        ],
      },
      {
        heading: "What they never do",
        points: [
          { key: "x", title: "Diagnose", text: "No diagnostic suggestions in any output." },
          {
            key: "x",
            title: "Triage clinically",
            text: "Agents route by document type and sender; urgency stays a clinical call.",
          },
          {
            key: "x",
            title: "Advise on treatment",
            text: "No treatment or follow-up recommendations.",
          },
        ],
      },
      {
        heading: "How we keep it that way",
        points: [
          {
            key: "file-check",
            title: "Written intended purpose",
            text: "Agreed with you before any deployment.",
          },
          {
            key: "user-check",
            title: "Review on every output",
            text: "Nothing reaches a record or a patient unapproved.",
          },
          {
            key: "history",
            title: "Everything logged",
            text: "What was suggested, and what the person changed.",
          },
          {
            key: "refresh-cw",
            title: "Re-checked on change",
            text: "Every new feature is tested against the line.",
          },
        ],
      },
    ],
    link: {
      label: "Read our briefing on the MHRA's July 2026 guidance",
      href: routes.insight("mhra-ai-scribe-guidance-clinic-admin"),
      intent: "read",
      insightSlug: "mhra-ai-scribe-guidance-clinic-admin",
    },
  },
  pilots: {
    heading: "In pilot: design partners wanted",
    products: [
      {
        key: "bot",
        meta: "Pilot",
        title: "Admin agents for clinics",
        text: "Inbox triage, letter drafting and coding support, with review built in.",
        points: [
          { key: "inbox", text: "Triage across email, scanned post and portals" },
          { key: "file-pen", text: "Letters drafted from notes" },
          { key: "tags", text: "Codes suggested for review" },
        ],
      },
    ],
    ask: "What we ask: a named contact, short regular reviews, and permission to publish anonymised results.",
    cta: partnerCta,
  },
  systems: {
    heading: "Systems we work with",
    points: [
      { key: "layout-dashboard", text: "Practice management systems with APIs" },
      { key: "mail", text: "Shared inboxes on Microsoft 365 and Google Workspace" },
      { key: "receipt", text: "Insurer billing and invoicing" },
      { key: "pen-line", text: "E-signature" },
      { key: "flask-conical", text: "Lab and pharmacy systems" },
      {
        key: "network",
        text: "NHS interfaces such as GP Connect and MESH, where your organisation has access",
      },
    ],
    note: "We confirm access and data flows during the audit.",
  },
  trust: {
    heading: "Trust and regulation",
    points: [
      {
        key: "shield-check",
        title: "NHS data security",
        text: "Help completing the Data Security and Protection Toolkit.",
      },
      {
        key: "file-lock",
        title: "Data protection",
        text: "A DPIA and processor terms for every deployment; purpose, access and retention agreed first.",
      },
      { key: "accessibility", title: "Accessibility", text: "Services built to WCAG 2.2 AA." },
    ],
  },
  caseStudies: {
    heading: "Case studies",
    fallbackSlugs: ["fauward-white-label-logistics-platform"],
    fallback: {
      key: "handshake",
      title: "Become a design partner",
      text: "We're taking a small number of clinics and courier firms as design partners.",
      href: partnerCta.href,
    },
  },
  insights: { heading: "Insights", topicSlug: "health-and-care" },
  faq: [
    {
      question: "Do your AI tools make clinical decisions?",
      answer:
        "No. They read, draft, route and suggest, and a member of your team approves every output before it reaches a record or a patient.",
    },
    {
      question: "Can you work with NHS organisations?",
      answer:
        "Yes. GP practices and PCNs can contract with us directly; for trusts, we work alongside suppliers already on NHS frameworks.",
    },
    {
      question: "Which systems can you connect?",
      answer:
        "Practice systems with APIs, shared inboxes, insurer billing, e-signature, and lab or pharmacy systems. We confirm access during the audit.",
    },
    {
      question: "How long is the audit, and what does it cost?",
      answer: "Two weeks. Pricing comes in a proposal once we understand your scope.",
    },
    {
      question: "What happens to patient data?",
      answer:
        "It's processed under a data processing agreement and a DPIA, and used only for the agreed purpose.",
    },
    {
      question: "Do you move samples or medicines?",
      answer:
        "No. We build the software couriers, labs and pharmacies use; packing and handling stay with them, and the software records each step.",
    },
  ],
  closing: {
    heading: "Have a clinic problem worth solving?",
    line: "Tell us where the admin hours go. We'll come back with a scoped audit proposal.",
    primary: auditCta,
    secondary: { label: "Explore what we do", href: routes.whatWeDo(), intent: "explore" },
  },
};
