/**
 * Case studies from work already shown on vitalos.co.uk (Website Build Pack, 25 Oct 2026, Part 3).
 * The copy is the owner's, word for word. All three are unpublished drafts until the owner
 * approves them, so production serves none of them and they open nothing.
 *
 * Rules (Part 3 content model): the client is described, not named, until written permission is
 * recorded (`clientPermission`); no metric is drafted (a metric needs a source and a verifier);
 * no quote is drafted (a quote needs a permission date). Outcomes stay as visible `[confirm: …]`
 * placeholders until the owner supplies verified figures. Health & Care stories are added only
 * after a pilot client signs off (docs/content/CASE-STUDIES.md).
 */
import { p, richText, seo, ul } from "../build";
import { BUILD_PACK, briefed, cite } from "../provenance";
import { DRAFTED_ON } from "../slugs";
import type { CaseStudyDraft } from "./draft-types";

const brief = `${BUILD_PACK}, Part 3`;
const sources = [cite(10, "17. Work / case-study launch"), cite(11, "19. Work index")];

export const buildPackCaseStudyDrafts: readonly CaseStudyDraft[] = [
  {
    slug: "doncaster-vehicle-workshop-booking",
    publishStatus: "draft",
    kind: "client",
    title: "Booking without the back-and-forth for a Doncaster vehicle workshop",
    summary:
      "Drivers wanted a diagnosis booked quickly, without creating an account, and the workshop needed bookings, enquiries, stock and invoices in one place.",
    seo: seo(
      "Workshop booking without the back-and-forth",
      "How Vitalos built a vehicle-first booking platform for a diagnostics-led workshop in Doncaster: seven steps from a registration lookup, no account needed.",
    ),
    updatedAt: DRAFTED_ON,
    engagementBasis: "contracted-by-vitalos",
    clientDisplay: "anonymised",
    sector: "A diagnostics-led vehicle workshop in Doncaster [confirm permission to name]",
    highlights: [
      { key: "car", text: "Booking starts from the registration" },
      { key: "user-x", text: "No account needed" },
      { key: "shield-check", text: "Two-factor staff sign-in" },
    ],
    visual: "Booking flow on a phone",
    challenge: richText(
      "case-sob-challenge",
      p(
        "Drivers wanted a diagnosis booked quickly, without creating an account, and the workshop needed bookings, enquiries, stock and invoices in one place.",
      ),
    ),
    approach: richText(
      "case-sob-approach",
      p("Vitalos built a vehicle-first platform."),
      ul(
        "Booking takes seven steps from a registration lookup with no account.",
        "Slots come from the workshop calendar and are rechecked before confirmation.",
        "Customers reschedule or cancel with their reference and registration.",
        "Registration numbers stay out of page URLs and analytics.",
        "Staff use one admin, protected by two-factor sign-in.",
      ),
    ),
    outcome: richText(
      "case-sob-outcome",
      p("[confirm: launch date, bookings per month, admin time saved]"),
    ),
    metrics: [],
    evidence: { status: "pending" },
    practices: ["engineering"],
    solutions: [],
    industries: ["retail-commerce-consumer"],
    products: ["sob-autofix"],
    provenance: briefed(
      sources,
      brief,
      "Client not named and no outcome figures until the workshop gives written permission and figures.",
    ),
  },
  {
    slug: "fauward-white-label-logistics-platform",
    publishStatus: "draft",
    kind: "product",
    title: "A white-label logistics platform, built and run by Vitalos",
    summary:
      "Courier start-ups, freight operators and 3PLs need booking, tracking, proof of delivery and invoicing under their own brand.",
    seo: seo(
      "A white-label logistics platform, built and run by Vitalos",
      "Fauward: shipment operations from booking to proof of delivery, a white-label portal, an offline-first driver app and invoicing on delivery.",
    ),
    updatedAt: DRAFTED_ON,
    engagementBasis: "vitalos-product",
    clientDisplay: "anonymised",
    highlights: [
      { key: "palette", text: "Your brand, your domain" },
      { key: "smartphone", text: "Offline-first driver app" },
      { key: "receipt", text: "Invoiced on delivery" },
    ],
    visual: "Tracking portal",
    challenge: richText(
      "case-fauward-challenge",
      p(
        "Courier start-ups, freight operators and 3PLs need booking, tracking, proof of delivery and invoicing under their own brand.",
      ),
    ),
    approach: richText(
      "case-fauward-approach",
      ul(
        "Shipment operations from booking to proof of delivery",
        "A white-label portal on the client's domain with no-login tracking",
        "Fauward Go, an offline-first field app with QR scanning, photos and signatures",
        "Invoicing on delivery with reconciliation",
        "Fauward Agent, which flags SLA risks and suggests actions that dispatchers approve",
        "A REST API and webhooks",
      ),
    ),
    outcome: richText("case-fauward-outcome", p("[confirm: operators live, shipments handled]")),
    metrics: [],
    evidence: { status: "pending" },
    practices: ["engineering"],
    solutions: [],
    industries: ["operations-industry-logistics"],
    offers: ["medical-logistics-digitisation"],
    products: ["fauward"],
    provenance: briefed(sources, brief, "No outcome figures until the owner supplies them."),
  },
  {
    slug: "askbridge-ai-website-assistant",
    publishStatus: "draft",
    kind: "product",
    title: "An AI website assistant that answers only from your own content",
    summary:
      "Visitors ask the same questions out of hours, and generic chatbots answer from outside the business's own information.",
    seo: seo(
      "An AI website assistant that answers from your content",
      "Askbridge answers only from a business's own pages, documents and FAQs, with numbered, quoted sources, and hands over to a named person on request.",
    ),
    updatedAt: DRAFTED_ON,
    engagementBasis: "vitalos-product",
    clientDisplay: "anonymised",
    highlights: [
      { key: "quote", text: "Answers with quoted sources" },
      { key: "user-round", text: "A person on request" },
      { key: "code", text: "One-tag install" },
    ],
    visual: "Chat widget on a site",
    challenge: richText(
      "case-askbridge-challenge",
      p(
        "Visitors ask the same questions out of hours, and generic chatbots answer from outside the business's own information.",
      ),
    ),
    approach: richText(
      "case-askbridge-approach",
      p(
        "Answers come only from the business's pages, documents and FAQs, with numbered, quoted sources.",
      ),
      p('Answers are tested with "Save Answer" checks and re-run when content changes.'),
      p(
        "Visitors can ask for a named person at any time; handoffs reach one team inbox with a summary.",
      ),
    ),
    outcome: richText(
      "case-askbridge-outcome",
      p("[confirm: sites live, share of questions answered without handoff]"),
    ),
    metrics: [],
    evidence: { status: "pending" },
    practices: ["ai-data"],
    solutions: [],
    industries: ["growth-technology"],
    products: ["askbridge"],
    provenance: briefed(sources, brief, "No outcome figures until the owner supplies them."),
  },
];
