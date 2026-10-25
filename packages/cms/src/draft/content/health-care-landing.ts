/**
 * The Health & Care lead page (Website Build Pack, 25 Oct 2026, Part 2). Every word is the
 * owner's, word for word; British English; short points only (a heading, one line, then points of
 * eight words or fewer). Point `key`s name the subject (the brief's Lucide names, as a guide); the
 * web app maps them to the site's own icons.
 *
 * Unpublished (`draft`): production keeps the standard Health & Care page until the owner approves
 * this one. `[confirm …]` marks are deliberate, visible placeholders for the owner to resolve.
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
  publishStatus: "draft",
  seo: seo(
    "Health & Care: consulting for clinics and NHS teams",
    "Give care teams their time back. Less admin. Connected systems. NHS-ready evidence. Fixed-scope engagements for clinics, GP practices and NHS teams.",
  ),
  eyebrow: "Health & Care",
  heading: "Give care teams their time back.",
  lead: "Less admin. Connected systems. NHS-ready evidence.",
  primaryCta: auditCta,
  secondaryCta: { label: "See offers", href: "#offers", intent: "explore" },
  painPoints: {
    heading: "Where the time goes",
    points: [
      { key: "inbox", text: "Referrals and results piling up" },
      { key: "file-text", text: "Letters typed after clinic" },
      { key: "unplug", text: "Systems that don't talk" },
      { key: "shield-check", text: "NHS evidence you don't have yet" },
    ],
  },
  offers: {
    heading: "Start with a fixed-scope engagement",
    anchor: "offers",
    points: [
      {
        key: "timer",
        title: "Clinic Admin Audit",
        meta: "2 weeks",
        text: "Find your admin hours. Automate the right ones.",
        href: routes.offer("clinic-admin-audit"),
      },
      {
        key: "plug",
        title: "Systems Integration",
        meta: "Medium",
        text: "Enter data once, everywhere.",
        href: routes.offer("systems-integration"),
      },
      {
        key: "badge-check",
        title: "NHS Assurance Readiness",
        meta: "Short",
        text: "DTAC, DSPT and safety case, ready.",
        href: routes.offer("nhs-assurance-readiness"),
      },
      {
        key: "truck",
        title: "Medical Logistics Digitisation",
        meta: "Medium",
        text: "Chain of custody, proof of delivery.",
        href: routes.offer("medical-logistics-digitisation"),
      },
    ],
  },
  steps: {
    heading: "How it works",
    points: [
      { key: "search", title: "Assess", text: "Two-week audit, measured baseline" },
      { key: "flask-conical", title: "Pilot", text: "One workflow, one team" },
      { key: "rocket", title: "Roll out", text: "More teams, more sites" },
      { key: "settings", title: "Operate", text: "We run and improve it" },
    ],
  },
  guardrails: {
    heading: "AI that drafts. People who decide.",
    does: [
      { key: "check", text: "Reads and routes inbound documents" },
      { key: "check", text: "Drafts letters for review" },
      { key: "check", text: "Suggests codes for review" },
    ],
    doesNot: [
      { key: "x", text: "No diagnosis" },
      { key: "x", text: "No clinical triage" },
      { key: "x", text: "No treatment advice" },
    ],
    link: {
      label: "Read the MHRA briefing",
      href: routes.insight("mhra-ai-scribe-guidance-clinic-admin"),
      intent: "read",
      insightSlug: "mhra-ai-scribe-guidance-clinic-admin",
    },
  },
  pilots: {
    heading: "In pilot: design partners wanted",
    points: [
      {
        key: "bot",
        title: "Admin agents for clinics [confirm name]",
        text: "Triage, letters, coding. Review built in.",
      },
      {
        key: "package-check",
        title: "Fauward for healthcare logistics",
        text: "Samples, fridge lines, controlled drugs. [confirm features]",
      },
    ],
    cta: partnerCta,
  },
  trust: {
    heading: "Trust",
    points: [
      { key: "stethoscope", text: "Clinical safety officer [confirm]" },
      { key: "shield-check", text: "DSPT support" },
      { key: "lock", text: "UK data hosting [confirm]" },
      { key: "file-lock", text: "DPIA for every deployment" },
      { key: "badge-check", text: "Cyber Essentials [confirm]" },
      { key: "accessibility", text: "WCAG 2.2 AA" },
    ],
  },
  caseStudies: {
    heading: "Case studies",
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
      answer: "No. Your team approves every output.",
    },
    {
      question: "Do you work with the NHS?",
      answer: "Yes: practices and PCNs directly, trusts with framework partners.",
    },
    {
      question: "Which systems can you connect?",
      answer: "Practice systems with APIs, inboxes, billing, e-signature, lab and pharmacy.",
    },
    {
      question: "How long is the audit, and what does it cost?",
      answer: "Two weeks. Pricing comes in a proposal.",
    },
    {
      question: "Do you move specimens or medicines?",
      answer: "No. We build the software that records each step.",
    },
  ],
  closing: {
    heading: "Have a clinic problem worth solving?",
    primary: auditCta,
    secondary: { label: "Explore what we do", href: routes.whatWeDo(), intent: "explore" },
  },
};
