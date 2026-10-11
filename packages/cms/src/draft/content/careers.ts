/**
 * Placeholder role (owner directive of 11 October 2026, ADR-025 status note).
 *
 * Stage 14 §17 names a Senior Engineer / Technical Lead as the first permanent hire, but no role is
 * open. This single role is INVENTED so the Careers pages can be reviewed. Guardrails: clearly
 * marked, no salary or benefits, no location claim, and no application URL, so the page falls back
 * to the Careers contact route (`/contact?intent=careers`).
 */
import type { JobView } from "../../content/types";
import { h2, p, richText, seo, ul } from "../build";
import { cite, placeholderDrafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import { DRAFTED_ON } from "../slugs";
import type { PracticeSlug } from "../slugs";

export interface JobDraft extends Omit<JobView, "id"> {
  placeholder: true;
  /** The practice the role belongs to (exported as the job's practice reference). */
  practice: PracticeSlug;
  provenance: DraftProvenance;
}

export const jobDrafts: readonly JobDraft[] = [
  {
    placeholder: true,
    slug: "senior-engineer-technical-lead",
    title: "Senior Engineer / Technical Lead (placeholder role)",
    summary:
      "Placeholder role, not an open vacancy. A senior engineering role in the Engineering practice, covering architecture, delivery quality and technical leadership on client engagements.",
    seo: {
      ...seo(
        "Senior Engineer / Technical Lead (placeholder role)",
        "A placeholder role in the Engineering practice. Not an open vacancy. Replace before launch.",
      ),
      noindex: true,
    },
    updatedAt: DRAFTED_ON,
    employmentType: "full-time",
    location: "To be confirmed (placeholder)",
    datePosted: DRAFTED_ON,
    status: "open",
    description: richText(
      "job-senior-engineer-description",
      p(
        "This is a placeholder role, written so that the Careers pages can be reviewed. It is not an open vacancy and describes no real position or location.",
      ),
      h2("The role"),
      p(
        "A senior engineer in the Engineering practice, adding delivery capacity and technical leadership on client engagements. The role shapes architecture decisions, raises delivery quality and helps other engineers grow.",
      ),
      h2("What you would do"),
      ul(
        "Design and build production-grade software and platforms with clear architecture decisions.",
        "Review work, set a high bar for testing and reliability, and mentor colleagues.",
        "Work directly with clients and with colleagues from the other practices.",
        "Take responsibility for operational readiness and handover.",
      ),
      h2("What we look for"),
      ul(
        "Judgement under ambiguity and depth in at least one meaningful discipline.",
        "Clear communication with clients and colleagues.",
        "Ownership, follow-through and respect for engineering and quality controls.",
        "Evidence-based thinking and low-ego collaboration.",
      ),
      p(
        "To register interest, use the application link on this page. It leads to the careers enquiry form.",
      ),
    ),
    practice: "engineering",
    provenance: placeholderDrafted(
      [
        cite(14, "17. Hiring sequence"),
        cite(14, "11. Engineering career track"),
        cite(14, "19. Vitalos talent bar"),
        cite(3, "5. Vitalos Engineering"),
      ],
      "Invented placeholder role (owner directive, 11 October 2026). No vacancy exists. No salary, benefits, location or closing date is drafted. Replace with a real role, or delete, before launch.",
    ),
  },
];
