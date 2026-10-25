/**
 * The Health & Care offers (Website Build Pack, 25 Oct 2026, Part 2 "Offer pages"). The copy is
 * the owner's, word for word: short points instead of paragraphs (`audiencePoints`,
 * `triggerPoints`). All three are unpublished drafts until the owner approves them, so production
 * serves none of them and no published page links to them.
 *
 * Items marked `[confirm …]` are deliberate, visible placeholders for the owner to resolve before
 * publication (a Clinical Safety Officer partner; which Fauward healthcare features exist). No
 * scope paragraph or next step is drafted: the brief gives none, and nothing is invented.
 */
import { routes } from "../../routes";
import type { CtaView } from "../../content/types";
import { seo } from "../build";
import { BUILD_PACK, briefed, cite } from "../provenance";
import type { OfferDraft } from "./draft-types";

const brief = `${BUILD_PACK}, Part 2 "Offer pages"`;
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

export const healthCareOfferDrafts: readonly OfferDraft[] = [
  {
    slug: "clinic-admin-audit",
    title: "Clinic Admin Audit",
    publishStatus: "draft",
    summary: "Find your admin hours in two weeks.",
    seo: seo(
      "Clinic Admin Audit",
      "Find your admin hours in two weeks: a workflow map, a time-per-document baseline, a ranked automation plan and a pilot proposal.",
    ),
    audience: "Private clinics, consultant groups and GP practices.",
    audiencePoints: ["Private clinics", "Consultant groups", "GP practices"],
    trigger: "A growing backlog, key staff leaving, or AI with no plan.",
    triggerPoints: ["Growing backlog", "Key staff leaving", "AI with no plan"],
    scope: "",
    outputs: [
      "Workflow map",
      "Time-per-document baseline",
      "Ranked automation plan",
      "Pilot proposal",
    ],
    requirements: ["Sponsor", "Admin team time", "Sample documents under a DPA", "System list"],
    durationCategory: "short",
    durationDetail: "2 weeks",
    exclusions: ["Clinical process changes", "Licences", "The pilot"],
    nextStep: "",
    solutions: ["business-process-modernisation", "ai-transformation"],
    practices: ["consulting", "ai-data"],
    cta: healthcareCta("Book a clinic admin audit", "clinic-admin-audit"),
    provenance: briefed(sources, brief),
  },
  {
    slug: "nhs-assurance-readiness",
    title: "NHS Assurance Readiness",
    publishStatus: "draft",
    summary: "NHS evidence, before procurement asks.",
    seo: seo(
      "NHS Assurance Readiness",
      "NHS evidence, before procurement asks: a DTAC form, an NHS-template DPIA, a DSPT submission and a gap list for health-tech suppliers.",
    ),
    audience: "Health-tech suppliers selling to the NHS.",
    audiencePoints: ["Health-tech suppliers selling to the NHS"],
    trigger: "A buyer asks for DTAC or DSPT.",
    triggerPoints: ["A buyer asks for DTAC or DSPT"],
    scope: "",
    outputs: [
      "DTAC form",
      "NHS-template DPIA",
      "DSPT submission",
      "DCB0129 safety case [confirm CSO]",
      "Gap list",
    ],
    requirements: ["Product docs", "Security and data owners", "Fast decisions"],
    durationCategory: "short",
    exclusions: ["Certification fees", "Legal advice", "Device conformity assessment"],
    nextStep: "",
    solutions: [],
    practices: ["consulting"],
    cta: healthcareCta("Discuss NHS assurance", "nhs-assurance-readiness"),
    provenance: briefed(
      sources,
      brief,
      "The DCB0129 safety case stays marked [confirm CSO] until a Clinical Safety Officer partner is confirmed; remove it otherwise.",
    ),
  },
  {
    slug: "medical-logistics-digitisation",
    title: "Medical Logistics Digitisation",
    publishStatus: "draft",
    summary: "Delivery records that pass an audit.",
    seo: seo(
      "Medical Logistics Digitisation",
      "Delivery records that pass an audit: custody and delivery records and driver app item checks for medical couriers, labs and pharmacy groups.",
    ),
    audience: "Medical couriers, labs and pharmacy groups.",
    audiencePoints: ["Medical couriers", "Labs", "Pharmacy groups"],
    trigger: "Paper run sheets and no proof of delivery.",
    triggerPoints: ["Paper run sheets", "No proof of delivery"],
    scope: "",
    outputs: [
      "Branded Fauward workspace",
      "Driver app item checks",
      "Custody and delivery records",
      "Client tracking [confirm features]",
    ],
    requirements: ["Operations owner", "Routes and procedures", "Driver training time"],
    durationCategory: "medium",
    exclusions: ["Vehicles and packaging", "Dangerous-goods training", "Data loggers"],
    nextStep: "",
    solutions: ["business-process-modernisation"],
    practices: ["engineering"],
    cta: healthcareCta("Discuss medical logistics", "medical-logistics-digitisation"),
    provenance: briefed(
      sources,
      brief,
      "Fauward healthcare features stay marked [confirm features] until the owner confirms which exist.",
    ),
  },
];
