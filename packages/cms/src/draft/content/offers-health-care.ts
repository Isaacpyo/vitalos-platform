/**
 * The Health & Care offers (Website Build Pack, revision 2, 25 Oct 2026, Part 2 "Offer pages").
 * The copy is the owner's, word for word: headed sections of points, each with an icon key, a bold
 * title and one supporting line, then a three-question FAQ. All three are unpublished drafts until
 * the owner approves them, so production serves none of them and no published page links to them.
 *
 * The plain-text fields (`audience`, `trigger`, `outputs`, `requirements`, `exclusions`) repeat
 * the same words for search, llms.txt and Relay. Items marked `[confirm …]` are deliberate, visible
 * placeholders for the owner to resolve before publication (a Clinical Safety Officer partner;
 * which Fauward healthcare features exist). No scope paragraph or next step is drafted: the brief
 * gives none, and nothing is invented.
 */
import { routes } from "../../routes";
import type { CtaView, LandingPoint, LandingSection } from "../../content/types";
import { seo } from "../build";
import { BUILD_PACK, briefed, cite } from "../provenance";
import type { OfferDraft } from "./draft-types";

const brief = `${BUILD_PACK}, revision 2, Part 2 "Offer pages"`;
const sources = [
  cite(2, "Health & Care"),
  cite(6, "11. Health & public-sector readiness"),
  cite(8, "12. Offer architecture"),
];

/** Every healthcare offer starts the healthcare enquiry with the offer recorded. */
const healthcareCta = (label: string, slug: string): CtaView => ({
  label,
  href: `${routes.contact("healthcare-audit")}&offer=${slug}`,
  intent: "healthcare-audit",
});

const point = (key: string, title: string, text: string): LandingPoint => ({ key, title, text });
const item = (key: string, text: string): LandingPoint => ({ key, text });
const section = (heading: string, points: readonly LandingPoint[]): LandingSection => ({
  heading,
  points,
});
/** "Title: line" for the plain-text fields. */
const plain = (points: readonly LandingPoint[]): string[] =>
  points.map((p) => (p.title ? `${p.title}: ${p.text}` : p.text));

const clinicAudience = [
  point(
    "building-2",
    "Private clinics and hospitals",
    "Front desks handling bookings, referrals, letters and insurer billing.",
  ),
  point(
    "users",
    "Consultant groups",
    "Letters, correspondence and invoicing spread across several consultants.",
  ),
  point("stethoscope", "GP practices", "Document workflow and coding across one site or many."),
];
const clinicTriggers = [
  point("inbox", "A backlog that keeps growing", "Documents wait days to be filed or actioned."),
  point("user-minus", "A key person leaving", "Admin know-how that lives in one person's head."),
  point(
    "bot",
    "AI with no starting point",
    "Interest in automation, but no idea where it would pay off.",
  ),
];
const clinicOutputs = [
  point(
    "workflow",
    "Workflow map",
    "Every document type from arrival to filing, with owners and systems.",
  ),
  point(
    "timer",
    "Baseline figures",
    "Minutes per document and weekly volumes, to measure any pilot against.",
  ),
  point(
    "list-checks",
    "Ranked automation plan",
    "What to automate first, the risks, and where a person must review.",
  ),
  point("file-text", "Pilot proposal", "Scope, timeline and cost for the first workflow."),
];
const clinicNeeds = [
  point("user-check", "A named sponsor", "Someone who can make decisions and unblock access."),
  point("clock", "Time with the admin team", "Shadowing sessions and short interviews."),
  point("file-lock", "Sample documents", "Shared under a data processing agreement."),
  point("layout-dashboard", "Your system list", "Practice, billing, email and lab systems in use."),
];
const clinicExclusions = [
  item("x", "Changes to clinical processes"),
  item("x", "Software licences"),
  item("x", "The pilot itself"),
];

const nhsAudience = [
  point("cpu", "Health-tech suppliers", "Software going into GP practices, trusts or ICBs."),
  point(
    "briefcase",
    "Service providers",
    "Companies handling NHS data or connecting to NHS systems.",
  ),
  point(
    "rocket",
    "Start-ups with a first NHS pilot",
    "A buyer is keen, and the paperwork is the blocker.",
  ),
];
const nhsTriggers = [
  point("file-question", "The DTAC form arrives", "And half the evidence doesn't exist yet."),
  point(
    "calendar-clock",
    "A DSPT deadline",
    "Version 9's baseline submission is due by 31 December 2026.",
  ),
  point(
    "stethoscope",
    "No clinical safety case",
    "DCB0129 needs a hazard log and a safety case report.",
  ),
];
const nhsCoverage = [
  point(
    "clipboard-check",
    "DTAC",
    "All five areas of the April 2026 form: clinical safety, data, security, interoperability, accessibility.",
  ),
  point(
    "file-lock",
    "Data protection",
    "A DPIA on NHS England's template, privacy notices and processor terms.",
  ),
  point("shield-check", "DSPT", "Your submission prepared with evidence, ready for your sign-off."),
  point(
    "stethoscope",
    "Clinical safety",
    "DCB0129 hazard log and safety case, reviewed by a qualified CSO. [confirm partner]",
  ),
  point(
    "accessibility",
    "Accessibility",
    "WCAG 2.2 AA checks and the Accessible Information Standard.",
  ),
];
const nhsOutputs = [
  point(
    "folder-check",
    "An evidence pack",
    "Versioned with your product and reusable for every procurement.",
  ),
  point("list-todo", "A gap list", "Each gap with an owner, a fix and a date."),
  point("calendar-clock", "A renewal calendar", "When each piece of evidence needs refreshing."),
];
const nhsNeeds = [
  item("file-text", "Product and architecture documents"),
  item("users", "Access to security and data owners"),
  item("check", "Quick decisions on gaps"),
];
const nhsExclusions = [
  item("x", "Certification and third-party testing fees"),
  item("x", "Legal advice"),
  item("x", "Medical device conformity assessment"),
];

const logisticsAudience = [
  point("truck", "Medical courier firms", "Moving samples between clinics, surgeries and labs."),
  point(
    "flask-conical",
    "Private labs",
    "Collecting from many sites and needing proof of custody.",
  ),
  point("pill", "Pharmacy groups", "Home delivery, including fridge lines and controlled drugs."),
];
const logisticsTriggers = [
  point("clipboard", "Paper run sheets", "Records that are slow to find and easy to lose."),
  point("file-x", "Missing proof of delivery", "No signature, photo or time when a client asks."),
  point(
    "shield-question",
    "A client asks for chain of custody",
    "And the only answer is a spreadsheet.",
  ),
];
const logisticsRules = [
  point(
    "package",
    "UN3373 samples",
    "Packed to ADR P650 and marked by the sender; spills and damage reported.",
  ),
  point(
    "pill",
    "Pharmacy deliveries",
    "The GPhC expects tracking and records of consent, method, dispatch and successful delivery.",
  ),
];
const logisticsSetup = [
  point("palette", "Your brand", "Portal and no-login tracking on your domain, colours and logo."),
  point("scan-barcode", "Scan at every handoff", "Who had each item, where and when. [confirm]"),
  point(
    "list-checks",
    "Checks in the driver app",
    "Packaging, fridge-line and controlled-drug steps that can't be skipped. [confirm]",
  ),
  point(
    "pen-line",
    "Proof of delivery",
    "Photo, signature or one-time code; dual signatures for controlled drugs. [confirm dual signatures]",
  ),
  point(
    "file-down",
    "Audit exports",
    "Custody and delivery records per item, ready for a client or inspector. [confirm]",
  ),
  point("receipt", "Invoicing on delivery", "Invoices raised on delivery and reconciled."),
];
const logisticsNeeds = [
  item("user-check", "An operations owner"),
  item("map", "Routes, clients and handling procedures"),
  item("clock", "Drivers' time for training"),
];
const logisticsExclusions = [
  item("x", "Vehicles, packaging and temperature-controlled containers"),
  item("x", "Dangerous-goods training"),
  item("x", "Hardware data loggers"),
];

export const healthCareOfferDrafts: readonly OfferDraft[] = [
  {
    slug: "clinic-admin-audit",
    title: "Clinic Admin Audit",
    publishStatus: "draft",
    summary:
      "In two weeks, find out where your clinic's admin hours go and which steps are worth automating first.",
    seo: seo(
      "Clinic Admin Audit",
      "In two weeks, find out where your clinic's admin hours go and which steps are worth automating first: a workflow map, baseline and ranked plan.",
    ),
    audience: plain(clinicAudience).join(" "),
    trigger: plain(clinicTriggers).join(" "),
    scope: "",
    outputs: plain(clinicOutputs),
    requirements: plain(clinicNeeds),
    durationCategory: "short",
    durationDetail: "2 weeks",
    exclusions: plain(clinicExclusions),
    nextStep: "",
    sections: [
      section("Who this is for", clinicAudience),
      section("Problem or trigger", clinicTriggers),
      section("How the two weeks run", [
        point(
          "calendar",
          "Days 1–3, kick off and shadow",
          "Agree scope, sign the data processing agreement, sit with the admin team.",
        ),
        point(
          "git-branch",
          "Days 4–7, map and time",
          "Trace each document type from arrival to filing and time every step.",
        ),
        point(
          "list-ordered",
          "Days 8–10, rank and present",
          "Score each step by time saved and risk, then walk your team through the plan.",
        ),
      ]),
      section("What you receive", clinicOutputs),
      section("What we need from you", clinicNeeds),
      section("Not included", clinicExclusions),
    ],
    faq: [
      {
        question: "Will you see patient data?",
        answer:
          "Only sample documents, under a data processing agreement, and only what the audit needs.",
      },
      {
        question: "Do we have to buy anything afterwards?",
        answer: "No. You keep the map, baseline and plan whatever you decide.",
      },
      {
        question: "Will it disrupt the team?",
        answer: "Shadowing runs alongside normal work, at times agreed with the team.",
      },
    ],
    solutions: ["business-process-modernisation", "ai-transformation"],
    practices: ["consulting", "ai-data"],
    cta: healthcareCta("Book a clinic admin audit", "clinic-admin-audit"),
    provenance: briefed(sources, brief),
  },
  {
    slug: "nhs-assurance-readiness",
    title: "NHS Assurance Readiness",
    publishStatus: "draft",
    summary:
      "Build the evidence NHS buyers ask for before a procurement starts and the clock is running.",
    seo: seo(
      "NHS Assurance Readiness",
      "Build the evidence NHS buyers ask for before a procurement starts: DTAC, a DPIA, a DSPT submission, clinical safety and accessibility.",
    ),
    audience: plain(nhsAudience).join(" "),
    trigger: plain(nhsTriggers).join(" "),
    scope: "",
    outputs: plain(nhsOutputs),
    requirements: plain(nhsNeeds),
    durationCategory: "short",
    exclusions: plain(nhsExclusions),
    nextStep: "",
    sections: [
      section("Who this is for", nhsAudience),
      section("Problem or trigger", nhsTriggers),
      section("What we cover", nhsCoverage),
      section("What you receive", nhsOutputs),
      section("What we need from you", nhsNeeds),
      section("Not included", nhsExclusions),
    ],
    faq: [
      {
        question: "Do you certify us?",
        answer:
          "No. We prepare the evidence; buyers and certification bodies make their own assessment.",
      },
      {
        question: "What if our product is a medical device?",
        answer:
          "You'll also need UKCA conformity work, which sits outside this offer; we flag it early.",
      },
      {
        question: "How long does it take?",
        answer: "Usually a short engagement; longer if major gaps turn up.",
      },
    ],
    solutions: [],
    practices: ["consulting"],
    cta: healthcareCta("Discuss NHS assurance", "nhs-assurance-readiness"),
    provenance: briefed(
      sources,
      brief,
      "Clinical safety stays marked [confirm partner] until a Clinical Safety Officer partner is confirmed; remove it otherwise.",
    ),
  },
  {
    slug: "medical-logistics-digitisation",
    title: "Medical Logistics Digitisation",
    publishStatus: "draft",
    summary:
      "Give every sample and medicine movement a record that stands up to an audit, under your own brand.",
    seo: seo(
      "Medical Logistics Digitisation",
      "Give every sample and medicine movement a record that stands up to an audit, under your own brand: custody scans, driver checks and proof of delivery.",
    ),
    audience: plain(logisticsAudience).join(" "),
    trigger: plain(logisticsTriggers).join(" "),
    scope: "",
    outputs: plain(logisticsSetup),
    requirements: plain(logisticsNeeds),
    durationCategory: "medium",
    exclusions: plain(logisticsExclusions),
    nextStep: "",
    sections: [
      section("Who this is for", logisticsAudience),
      section("Problem or trigger", logisticsTriggers),
      section("What the rules ask for", logisticsRules),
      section("What we set up on Fauward", logisticsSetup),
      section("What we need from you", logisticsNeeds),
      section("Not included", logisticsExclusions),
    ],
    faq: [
      {
        question: "Is Fauward built for healthcare?",
        answer:
          "It's a white-label logistics platform we built and run; this engagement adds the checks and records healthcare work needs.",
      },
      {
        question: "Do you make the deliveries?",
        answer: "No. Your drivers do; the software records each step.",
      },
      {
        question: "Can our clients track items?",
        answer: "Yes. Tracking needs no login and runs under your brand.",
      },
    ],
    solutions: ["business-process-modernisation"],
    practices: ["engineering"],
    cta: healthcareCta("Discuss medical logistics", "medical-logistics-digitisation"),
    provenance: briefed(
      sources,
      brief,
      "Fauward healthcare features stay marked [confirm] until the owner confirms which exist.",
    ),
  },
];
