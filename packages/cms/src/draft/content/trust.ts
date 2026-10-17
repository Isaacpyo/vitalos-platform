/**
 * Trust Centre topics (Stage 6 §8-14; Stage 8 §18; Stage 10 §20). Stage 6 §1 defines what must
 * exist without claiming it does, and §2 says the public surface exposes only controls and claims
 * that actually exist. So every control here is worded as a standard or a target Vitalos is
 * putting in place, never as a present fact; the owner confirms each one before it may be stated
 * as existing (see docs/content/draft-inventory.md).
 *
 * Six topics only. Certifications and Subprocessors are not drafted: with nothing verified to list,
 * Stage 10 §20 says to omit empty certification blocks and places the subprocessor list in Wave 2,
 * and Stage 6 §2 prefers a smaller, truthful Trust Centre. Their routes answer 404.
 */
import { trustTopicLabels } from "../../locked-copy";
import type { TrustTopicView } from "../../content/types";
import type { TrustTopic } from "../../routes";
import { h2, p, pLink, richText, seo, ul } from "../build";
import { cite, drafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import { DRAFTED_ON, draftId } from "../slugs";

/** The accessibility topic's body. The full statement is /legal/accessibility (repo/legal.ts). */
const trustAccessibilityBody = richText(
  "trust-accessibility",
  h2("This website"),
  p(
    "The target for this website is WCAG 2.2 Level AA, treated as a build requirement rather than an after-launch audit: semantic structure, keyboard operation, visible focus, sufficient contrast, accessible forms, reduced-motion support and reflow without loss of function.",
  ),
  p(
    "A full accessibility statement will be published after the site has been evaluated. We do not display conformance badges without a supporting assessment.",
  ),
  h2("Services we deliver"),
  p(
    "Our delivery standard makes accessibility one of the quality gates before release: applicable interfaces are checked against the accessibility standard agreed for the engagement.",
  ),
);

export interface TrustDraft {
  view: TrustTopicView;
  provenance: DraftProvenance;
}

/** Introduces a list of standards: they are commitments, not controls declared to exist. */
const standardsNote = p(
  "This page sets out the standards Vitalos works to and is putting in place. They are commitments, not certified controls.",
);

const trustCentre = cite(8, "18. Trust Centre architecture");

const ownerConfirmation =
  "Each control is worded as a standard or target; the owner confirms it exists before it can be stated as in place (Stage 6 §1, §2).";

function topic(
  slug: TrustTopic,
  summary: string,
  description: string,
  body: ReturnType<typeof richText>,
  sources: Parameters<typeof drafted>[0],
  omitted?: string,
): TrustDraft {
  return {
    view: {
      id: draftId("trustItem", slug),
      topic: slug,
      title: trustTopicLabels[slug],
      summary,
      seo: seo(`${trustTopicLabels[slug]} | Trust Centre`, description),
      updatedAt: DRAFTED_ON,
      publicSummary: body,
      certifications: [],
      subprocessors: [],
    },
    provenance: drafted([trustCentre, ...sources], omitted),
  };
}

export const trustDrafts: readonly TrustDraft[] = [
  topic(
    "security",
    "Security is designed into how we work and what we deliver, not added at release.",
    "The security standards Vitalos works to in its own operations and in the systems it delivers: security designed into how we work, not added at release.",
    richText(
      "trust-security",
      standardsNote,
      h2("In our own operations"),
      p("Vitalos is putting in place a minimum security foundation for its own systems:"),
      ul(
        "multi-factor authentication and least-privilege access on critical systems, with periodic access reviews;",
        "managed credentials and secrets, which are never committed to source control;",
        "timely security updates, and vulnerability and dependency management;",
        "a documented security incident response procedure;",
        "joiner, mover and leaver access processes, including for contractors;",
        "an inventory of suppliers and of the third parties that process data for us.",
      ),
      h2("In the systems we deliver"),
      p("Our delivery standard is:"),
      ul(
        "security and privacy by design, proportionate to exposure, data, business criticality and regulatory context;",
        "version control, peer review and automated checks before material changes reach production;",
        "a security gate before release, reviewing attack surface, identity, secrets and dependency risks;",
        "contractors and partners working to Vitalos security standards, with access removed promptly when no longer needed.",
      ),
      h2("Reporting a security concern"),
      // Owner direction, 15 Oct 2026: support@ is the security contact (no security@ mailbox).
      p("Security contact: support@vitalos.co.uk."),
      // RFC 9116 file (finding B8, 17 Oct 2026): the same contact, machine-readable.
      pLink("The same contact is published in ", "security.txt", "/.well-known/security.txt", "."),
    ),
    [
      cite(6, "8. Security & privacy readiness"),
      cite(5, "14.2 Security-by-design"),
      cite(5, "12.2 Source and change control"),
      cite(5, "11. Mandatory quality gates"),
      cite(5, "Non-negotiable contractor model"),
      cite(6, "14. Vitalos Trust Centre"),
      cite(10, "20. Trust Centre production"),
    ],
    `${ownerConfirmation} The security contact is a placeholder: Stage 10 §20 requires a monitored contact (and security.txt only once disclosure is operational).`,
  ),
  topic(
    "privacy",
    "Personal data should be collected only when it is needed, and handled deliberately.",
    "The data protection standards Vitalos works to on this website and in client delivery: personal data collected only when needed and handled deliberately.",
    richText(
      "trust-privacy",
      standardsNote,
      h2("On this website"),
      ul(
        "Enquiry forms collect only what is needed to respond to and qualify an enquiry.",
        "Enquirers are not subscribed to marketing.",
        "Our standard is to keep personal data out of general platform logs.",
      ),
      h2("In client delivery"),
      p("Our standard is that:"),
      ul(
        "where delivery involves personal data, its purposes, collection, access, retention, third-party processing and deletion are made visible;",
        "whether Vitalos acts as controller or processor is assessed, with a data processing agreement where Vitalos processes data on a client's behalf;",
        "higher-risk processing goes through a data protection impact assessment;",
        "legal interpretation is escalated to qualified advisers, because engineering judgement does not replace legal advice.",
      ),
      p("The website privacy notice sets out how personal data is handled through this site."),
    ),
    [
      cite(6, "8.3 Data-protection evidence"),
      cite(5, "14.3 Privacy-by-design"),
      cite(10, "25. Privacy & consent implementation"),
      cite(10, "21. Lead capture & enquiry architecture"),
      cite(16, "29. Data Processing Agreement architecture"),
    ],
    `${ownerConfirmation} No ICO registration number or privacy contact: neither is supplied.`,
  ),
  topic(
    "responsible-ai",
    "AI must solve a legitimate problem, stay accountable to a person and be evaluated before and after it goes live.",
    "The Responsible AI principles Vitalos applies to the AI it builds and runs: a legitimate problem, a person accountable, evaluation before and after launch.",
    richText(
      "trust-responsible-ai",
      h2("Principles"),
      ul(
        "Purpose: AI must solve a legitimate business or user problem.",
        "Accountability: a human owner remains responsible for every deployed system.",
        "Transparency: clients understand material model and provider limitations and where AI is used.",
        "Privacy and security: sensitive data is handled deliberately and access is controlled.",
        "Evaluation: production AI is tested against defined quality and risk criteria.",
        "Human oversight: higher-risk decisions include appropriate review or escalation.",
        "Fairness: foreseeable discriminatory or harmful outcomes are considered.",
        "Reliability: failure, fallback and provider or model change are designed for.",
        "Traceability: important instructions, models, data sources and evaluations are versioned where appropriate.",
        "Continuous monitoring: material AI services are re-evaluated as models, prompts, data and context change.",
      ),
      h2("Questions we aim to answer"),
      p(
        "For an AI system we deliver, Vitalos aims to be able to answer where your data goes, which model or provider processes it, whether it is used for provider training, where it is stored, what retention applies, what tools and permissions an agent has, how outputs are evaluated and what happens when the model fails.",
      ),
    ),
    [
      cite(6, "9. AI trust & Responsible AI"),
      cite(5, "13.1 AI lifecycle"),
      cite(3, "11.2 AI engagement principles"),
    ],
    'Stage 6 §9 says Vitalos should publish simple principles early; the procurement answers are worded as an aim ("should be able to answer") for the owner to confirm.',
  ),
  topic(
    "accessibility",
    "This website is being built to WCAG 2.2 Level AA, and the services we deliver are checked against an agreed accessibility target.",
    "Vitalos's accessibility commitment: this website is being built to WCAG 2.2 Level AA, and the services we deliver are checked against an agreed target.",
    trustAccessibilityBody,
    [
      cite(8, "24. Accessibility architecture"),
      cite(5, "11. Mandatory quality gates"),
      cite(10, "26. Accessibility QA programme"),
    ],
    "No conformance claim or accessibility statement: the site has not been evaluated yet (Stage 8 §24).",
  ),
  topic(
    "resilience",
    "Recovery should be planned and tested in proportion to how critical a service is.",
    "The continuity and recovery standards Vitalos works to for the live services it operates, with recovery planned and tested in proportion to criticality.",
    richText(
      "trust-resilience",
      standardsNote,
      p("Our standard is that:"),
      ul(
        "recovery requirements match data and service criticality: what can be restored, from where, how long it should take and who decides;",
        "a backup that has never been validated is not treated as proven recovery capability;",
        "every production release has a rollback or recovery plan, and a deadline is not approval to skip it;",
        "incidents are classified by severity, with immediate escalation and recovery first for critical events;",
        "live services have explicit ownership, monitoring and runbooks before service-level-backed operation begins.",
      ),
      p(
        "Specific response targets belong in each service agreement; they are not promised generically here.",
      ),
    ),
    [
      cite(5, "12.5 Backup, recovery and rollback"),
      cite(5, "14.4 Incident escalation"),
      cite(5, "6.2 Release"),
      cite(5, "17.2 Service transition"),
      cite(6, "4.3 Corporate policies visible to buyers"),
    ],
    ownerConfirmation,
  ),
  topic(
    "procurement",
    "Procurement and security questionnaires, and requests for controlled documents, have a dedicated route.",
    "How to ask Vitalos procurement, security and assurance questions, send questionnaires and request controlled documents through a dedicated route.",
    richText(
      "trust-procurement",
      p(
        "Use the procurement and security route on the contact page for questionnaires, supplier onboarding and requests for controlled documents.",
      ),
      ul(
        "Where controlled documents exist, they are shared under appropriate confidentiality rather than published.",
        "Answers reflect what currently exists; we do not describe evidence we do not hold.",
        "Insurance cover is never stated beyond the actual policy.",
      ),
    ),
    [
      cite(6, "10. Enterprise procurement pack"),
      cite(6, "14. Vitalos Trust Centre"),
      cite(6, "12. Insurance & risk transfer"),
    ],
    "No insurance, policy or certificate details: none are supplied.",
  ),
];

/** Trust topics deliberately not drafted, and why (recorded in the inventory and ADR-025). */
export const omittedTrustTopics: Readonly<Partial<Record<TrustTopic, string>>> = {
  certifications:
    "No certification is recorded as held. Stage 10 §20 says omit empty certification blocks; Stage 6 §14 forbids 'coming soon' entries.",
  subprocessors:
    "The specs name no subprocessors; Stage 10 §20 places the subprocessor list in Wave 2, and Stage 6 §2 prefers a smaller, truthful Trust Centre.",
};
