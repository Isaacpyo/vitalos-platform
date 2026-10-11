/**
 * Placeholder personas (owner directive of 11 October 2026, ADR-025 status note).
 *
 * The strategy library names no public author or leader (Stage 8 §16, Stage 10 §18), so these three
 * people are INVENTED, so that Insights, Leadership and the author pages can be previewed. The
 * owner will replace them. Guardrails: ordinary invented names, role and focus areas taken from the
 * strategy documents only, and no credentials, employers, degrees, certifications, social links or
 * portraits. Every document carries `placeholder: true`, which turns off structured data, forces
 * `noindex`, shows the "Placeholder" notice and keeps the document out of the default Sanity export.
 */
import type { PersonView } from "../../content/types";
import { h2, p, richText, seo, ul } from "../build";
import { cite, placeholderDrafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import { DRAFTED_ON, draftId } from "../slugs";

export const personSlugs = ["alex-morgan", "sam-rivers", "jordan-ellis"] as const;
export type PersonSlug = (typeof personSlugs)[number];

export interface PersonDraft extends Omit<PersonView, "id" | "insights"> {
  slug: PersonSlug;
  placeholder: true;
  provenance: DraftProvenance;
}

/** SEO for a placeholder document: always noindex. */
const placeholderSeo = (title: string, description: string) => ({
  ...seo(title, description),
  noindex: true,
});

const omitted =
  "Invented placeholder persona (owner directive, 11 October 2026). No credentials, employers, degrees, certifications, social links or portrait are drafted. Replace with the real person, or delete, before launch.";

export const personDrafts: readonly PersonDraft[] = [
  {
    slug: "alex-morgan",
    placeholder: true,
    name: "Alex Morgan",
    role: "Founder and Managing Director",
    isLeadership: true,
    title: "Alex Morgan",
    summary:
      "Placeholder persona. Leads company strategy, client relationships and the standard Vitalos holds itself to, and writes about moving from technology advice to working production systems.",
    seo: placeholderSeo(
      "Alex Morgan (placeholder)",
      "Placeholder persona for the Founder and Managing Director role. Replace before launch.",
    ),
    updatedAt: DRAFTED_ON,
    bio: richText(
      "person-alex-morgan-bio",
      p(
        "Alex Morgan is a placeholder persona standing in for the founder and managing director of Vitalos. The profile exists so that the leadership and author pages can be reviewed; it describes a role, not a real person.",
      ),
      h2("Role"),
      p(
        "The founder owns company strategy, brand and market positioning, the most important client relationships, leadership hiring and the major risk and reputation decisions. In the earliest phase the role also covers early selling and practice direction where no leader yet exists.",
      ),
      h2("Focus areas"),
      ul(
        "Where technology and AI create business advantage, and where they do not.",
        "Moving from advice to engineering and operation, so a recommendation is carried into production.",
        "Delivery discipline, commercial sense and senior accountability on every engagement.",
        "Building a firm with several credible practitioners rather than a single voice.",
      ),
    ),
    credentials: [],
    sameAs: [],
    provenance: placeholderDrafted(
      [
        cite(14, "3. Founder & CEO role architecture"),
        cite(14, "5. Leadership architecture"),
        cite(13, "5. Founder brand architecture"),
      ],
      omitted,
    ),
  },
  {
    slug: "sam-rivers",
    placeholder: true,
    name: "Sam Rivers",
    role: "Engineering Lead",
    isLeadership: false,
    title: "Sam Rivers",
    summary:
      "Placeholder persona. Represents the Engineering lead: architecture, modernisation, reliability and engineering quality, and the handover of live systems.",
    seo: placeholderSeo(
      "Sam Rivers (placeholder)",
      "Placeholder persona for the Engineering lead role. Replace before launch.",
    ),
    updatedAt: DRAFTED_ON,
    bio: richText(
      "person-sam-rivers-bio",
      p(
        "Sam Rivers is a placeholder persona standing in for the Vitalos Engineering lead. The profile describes a role and its territory, not a real person.",
      ),
      h2("Role"),
      p(
        "The Engineering lead owns the engineering quality bar and the technical judgement behind designs, reviews and releases, and is the first technical escalation point on delivery.",
      ),
      h2("Focus areas"),
      ul(
        "Architecture decisions and how they are recorded.",
        "Application modernisation: when to repair, refactor or replace.",
        "Reliability, performance, testing and quality engineering.",
        "Integration and APIs, platform and cloud engineering, and security by design.",
        "Operational handover, so a system can be run by the people who inherit it.",
      ),
    ),
    credentials: [],
    sameAs: [],
    provenance: placeholderDrafted(
      [
        cite(13, "6. Expert voice system"),
        cite(13, "24. Engineering reputation system"),
        cite(3, "5. Vitalos Engineering"),
      ],
      omitted,
    ),
  },
  {
    slug: "jordan-ellis",
    placeholder: true,
    name: "Jordan Ellis",
    role: "AI and Data Lead",
    isLeadership: false,
    title: "Jordan Ellis",
    summary:
      "Placeholder persona. Represents the AI and Data lead: AI evaluation, data foundations, agents and governance, with a focus on production rather than demonstration.",
    seo: placeholderSeo(
      "Jordan Ellis (placeholder)",
      "Placeholder persona for the AI and Data lead role. Replace before launch.",
    ),
    updatedAt: DRAFTED_ON,
    bio: richText(
      "person-jordan-ellis-bio",
      p(
        "Jordan Ellis is a placeholder persona standing in for the Vitalos AI and Data lead. The profile describes a role and its territory, not a real person.",
      ),
      h2("Role"),
      p(
        "The AI and Data lead owns the specialist method for AI and data work: how opportunities are chosen, how prototypes are judged, and how production AI is evaluated, governed and operated.",
      ),
      h2("Focus areas"),
      ul(
        "AI opportunity prioritisation and data readiness.",
        "The move from prototype to production, and the evidence needed to justify it.",
        "Evaluation and quality measurement, human oversight, cost, latency and reliability.",
        "Agents and tool orchestration with bounded, controlled scope.",
        "Responsible AI and governance, and the operation of live AI capabilities.",
      ),
    ),
    credentials: [],
    sameAs: [],
    provenance: placeholderDrafted(
      [
        cite(13, "6. Expert voice system"),
        cite(13, "23. AI reputation system"),
        cite(3, "6. Vitalos AI & Data"),
      ],
      omitted,
    ),
  },
];

export const personId = (slug: PersonSlug): string => draftId("person", slug);
