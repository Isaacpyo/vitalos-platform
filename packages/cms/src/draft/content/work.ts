/**
 * Placeholder case studies (owner directive of 11 October 2026, ADR-025 status note).
 *
 * No client, case study or outcome exists (Stage 6 §1, Stage 10 §17). These two are ILLUSTRATIVE
 * SCENARIOS written from the service architecture (Stage 3) and delivery model (Stage 5), so the
 * Work pages can be reviewed. Guardrails: anonymised with a generic descriptor, no named client, no
 * outcome narrative, no metrics, no testimonial, evidence stays `pending`. The draft source counts
 * them towards the Work gate only because they are flagged `placeholder`; the production rule
 * (verified evidence only) is unchanged.
 */
import type { CaseStudyView } from "../../content/types";
import { h2, p, richText, seo, ul } from "../build";
import { cite, placeholderDrafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import { DRAFTED_ON } from "../slugs";
import type { IndustrySlug, PracticeSlug, SolutionSlug } from "../slugs";

export interface CaseStudyDraft extends Omit<
  CaseStudyView,
  "id" | "practices" | "solutions" | "industries"
> {
  placeholder: true;
  practices: readonly PracticeSlug[];
  solutions: readonly SolutionSlug[];
  industries: readonly IndustrySlug[];
  provenance: DraftProvenance;
}

const omitted =
  "Illustrative scenario, not a real engagement (owner directive, 11 October 2026). No client, outcome, metric, testimonial or result is drafted; evidence stays pending. Replace with a real, permissioned case study, or delete, before launch.";

export const caseStudyDrafts: readonly CaseStudyDraft[] = [
  {
    placeholder: true,
    slug: "connecting-field-and-warehouse-systems",
    title: "Illustrative scenario: connecting field and warehouse systems",
    summary:
      "Illustrative scenario, not a real engagement. How a systems integration engagement could be shaped for a logistics operator whose field, warehouse and finance systems do not exchange information reliably.",
    seo: {
      ...seo(
        "Illustrative scenario: field and warehouse systems",
        "An illustrative placeholder scenario for a UK logistics operator. Not a real engagement. Replace before launch.",
      ),
      noindex: true,
    },
    updatedAt: DRAFTED_ON,
    engagementBasis: "contracted-by-vitalos",
    clientDisplay: "anonymised",
    sector: "A UK logistics operator",
    challenge: richText(
      "case-field-warehouse-challenge",
      p(
        "Imagine a UK logistics operator whose depot, field and finance teams each rely on a different system. Jobs are re-keyed between them, status information is out of date by the time it is needed, and exceptions are handled through email and phone calls.",
      ),
      p(
        "Nobody has a complete picture of the data flows, some behaviour is known only to long-serving staff, and the operation cannot pause while the systems are changed.",
      ),
      ul(
        "Manual handoffs between disconnected platforms.",
        "Inconsistent definitions of a job, a delivery and an exception.",
        "Little visibility when an exchange between systems fails.",
        "A live operation that cannot tolerate a single large cut-over.",
      ),
    ),
    approach: richText(
      "case-field-warehouse-approach",
      p(
        "This scenario follows the Vitalos delivery lifecycle (Stage 5) and the Systems Integration offer (Stage 3).",
      ),
      h2("Discover and define"),
      p(
        "Map the systems, data flows, owners and failure modes before committing to a design. Agree which flows matter most, what done means for each, and what is explicitly out of scope.",
      ),
      h2("Design and engineer"),
      p(
        "Design interface contracts and data ownership for the priority flows, with retries that cannot create duplicates and clear handling of failures. Build incrementally behind version control, peer review and automated checks, and add observability to each exchange.",
      ),
      h2("Validate, release and operate"),
      p(
        "Validate integrations against realistic failure cases, release in small reversible steps alongside the existing process, and agree who monitors the exchanges and what happens when one fails.",
      ),
    ),
    metrics: [],
    evidence: { status: "pending" },
    practices: ["engineering"],
    solutions: ["business-process-modernisation"],
    industries: ["operations-industry-logistics"],
    provenance: placeholderDrafted(
      [
        cite(3, "5.2 Initial engineering offers"),
        cite(3, "9. Cross-Practice Solution Plays"),
        cite(5, "3. Vitalos Delivery Lifecycle"),
        cite(5, "6.1 Validation"),
      ],
      omitted,
    ),
  },
  {
    placeholder: true,
    slug: "from-ai-assessment-to-a-prototype-decision",
    title: "Illustrative scenario: from AI assessment to a prototype decision",
    summary:
      "Illustrative scenario, not a real engagement. How the signature AI client journey could run for a retail and commerce business that wants to know where AI is worth testing.",
    seo: {
      ...seo(
        "Illustrative scenario: from AI assessment to prototype",
        "An illustrative placeholder scenario for a UK retail business. Not a real engagement. Replace before launch.",
      ),
      noindex: true,
    },
    updatedAt: DRAFTED_ON,
    engagementBasis: "contracted-by-vitalos",
    clientDisplay: "anonymised",
    sector: "A UK retail and commerce business",
    challenge: richText(
      "case-ai-assessment-challenge",
      p(
        "Imagine a UK retail and commerce business whose leadership has a long list of AI ideas, from customer service to stock planning, and no agreed way to choose between them. Earlier experiments produced demonstrations that nobody owned.",
      ),
      ul(
        "Many candidate use cases and no shared criteria for ranking them.",
        "Uncertainty about whether the data behind each idea is ready.",
        "A wish to avoid another pilot that cannot be taken further.",
        "Questions from risk and legal about oversight, privacy and security.",
      ),
    ),
    approach: richText(
      "case-ai-assessment-approach",
      p(
        "This scenario follows the Signature AI Client Journey (Stage 3) and the AI and Data delivery standard (Stage 5).",
      ),
      h2("AI Opportunity Assessment"),
      p(
        "Rank candidate use cases by value, feasibility, data readiness and risk, with the business outcome and the accountable owner stated for each. The decision gate asks whether there is a use case worth testing.",
      ),
      h2("AI Prototype Sprint"),
      p(
        "Test the highest-value hypothesis quickly on real workflows, with evaluation criteria written down before the prototype is built. The decision gate asks whether the evidence justifies production investment, and a no is a legitimate answer.",
      ),
      h2("Next step"),
      p(
        "If the evidence supports it, scope production implementation with security, privacy, human oversight, observability and an operating plan. Prototype evidence does not automatically equal production readiness.",
      ),
    ),
    metrics: [],
    evidence: { status: "pending" },
    practices: ["ai-data"],
    solutions: ["ai-transformation"],
    industries: ["retail-commerce-consumer"],
    provenance: placeholderDrafted(
      [
        cite(3, "11. Signature AI Client Journey"),
        cite(3, "11.2 AI engagement principles"),
        cite(3, "6.2 Initial AI & Data offers"),
        cite(5, "13. AI & Data delivery standard"),
      ],
      omitted,
    ),
  },
];
